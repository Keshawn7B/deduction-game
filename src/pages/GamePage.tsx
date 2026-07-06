import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { CardView } from '../components/game/CardView'
import { Button } from '../components/ui/Button'
import { useAuth } from '../context/AuthContext'
import {
  leaveGame,
  listenToGameLog,
  listenToIdentities,
  listenToPlayers,
  listenToPlayerState,
  listenToRoom,
  revealCard,
  submitInitialClues,
} from '../firebase/rooms'
import type { PlayerGameState, PlayerIdentityDoc } from '../types/game'
import type { GameLogEntry } from '../types/log'
import type { LobbyPlayer, RoomDoc } from '../types/room'

function describeCard(card: { animal: string; disguise: string; location: string }) {
  return `${card.animal} / ${card.disguise} / ${card.location}`
}

export function GamePage() {
  const { roomCode = '' } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()

  const [room, setRoom] = useState<RoomDoc | null>(null)
  const [players, setPlayers] = useState<LobbyPlayer[]>([])
  const [playerState, setPlayerState] = useState<PlayerGameState | null>(null)
  const [identities, setIdentities] = useState<PlayerIdentityDoc[]>([])
  const [gameLog, setGameLog] = useState<GameLogEntry[]>([])
  const [selectedCardId, setSelectedCardId] = useState('')
  const [setupYesCardId, setSetupYesCardId] = useState('')
  const [setupNoCardId, setSetupNoCardId] = useState('')
  const [busy, setBusy] = useState(false)
  const [leaving, setLeaving] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    if (!roomCode || !user) return

    const unsubscribeRoom = listenToRoom(roomCode, setRoom)
    const unsubscribePlayers = listenToPlayers(roomCode, setPlayers)
    const unsubscribePlayerState = listenToPlayerState(
      roomCode,
      user.uid,
      setPlayerState,
    )
    const unsubscribeIdentities = listenToIdentities(roomCode, setIdentities)
    const unsubscribeGameLog = listenToGameLog(roomCode, setGameLog)

    return () => {
      unsubscribeRoom()
      unsubscribePlayers()
      unsubscribePlayerState()
      unsubscribeIdentities()
      unsubscribeGameLog()
    }
  }, [roomCode, user])

  useEffect(() => {
    if (room?.status === 'lobby') {
      navigate(`/lobby/${roomCode}`)
    }

    if (room?.status === 'finished') {
      navigate(`/winner/${roomCode}`)
    }
  }, [navigate, room?.status, roomCode])

  const isSetupPhase = room?.status === 'setupClues'
  const isPlaying = room?.status === 'playing'
  const isYourTurn = isPlaying && room?.currentTurnPlayerId === user?.uid
  const isEliminated = playerState?.eliminated ?? false

  const currentTurnName = useMemo(() => {
    if (isSetupPhase) {
      return 'Setup clues'
    }

    const currentPlayer = players.find(
      (player) => player.id === room?.currentTurnPlayerId,
    )

    return currentPlayer?.name ?? 'Unknown'
  }, [isSetupPhase, players, room?.currentTurnPlayerId])

  const setupReceiver = useMemo(() => {
    if (!user || players.length < 2) return null

    const currentIndex = players.findIndex((player) => player.id === user.uid)

    if (currentIndex === -1) return null

    return players[(currentIndex + 1) % players.length]
  }, [players, user])

  const setupReceiverIdentity = useMemo(() => {
    if (!setupReceiver) return null

    return (
      identities.find((identity) => identity.playerId === setupReceiver.id) ??
      null
    )
  }, [identities, setupReceiver])

  const visibleIdentities = useMemo(
    () => identities.filter((identity) => identity.playerId !== user?.uid),
    [identities, user?.uid],
  )

  const playerNameById = useMemo(() => {
    return new Map(players.map((player) => [player.id, player.name]))
  }, [players])

  async function handleSubmitInitialClues() {
    if (!user || !setupYesCardId || !setupNoCardId) return

    setBusy(true)
    setError('')
    setMessage('')

    try {
      await submitInitialClues({
        roomCode,
        giverId: user.uid,
        yesCardId: setupYesCardId,
        noCardId: setupNoCardId,
      })

      setMessage('Starting clues submitted. Waiting for the other players.')
      setSetupYesCardId('')
      setSetupNoCardId('')
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : 'Could not submit starting clues.',
      )
    } finally {
      setBusy(false)
    }
  }

  async function handleRevealCard() {
    if (!user || !selectedCardId) return

    setBusy(true)
    setError('')
    setMessage('')

    try {
      const result = await revealCard({
        roomCode,
        playerId: user.uid,
        cardId: selectedCardId,
      })

      setMessage(
        result === 'PENDING'
          ? 'Card revealed. Waiting for another player to answer.'
          : `Card revealed. Result: ${result}.`,
      )
      setSelectedCardId('')
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Could not reveal card.')
    } finally {
      setBusy(false)
    }
  }

  async function handleLeaveGame() {
    if (!user) return

    const confirmed = window.confirm(
      'Leave this game? You will be removed from active play.',
    )

    if (!confirmed) return

    setLeaving(true)
    setError('')

    try {
      await leaveGame({
        roomCode,
        playerId: user.uid,
      })

      navigate('/')
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Could not leave game.')
    } finally {
      setLeaving(false)
    }
  }

  return (
    <section className="mx-auto min-h-screen max-w-7xl px-4 py-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-black">Game</h1>
          <p className="text-slate-300">
            Room Code:{' '}
            <span className="font-mono font-black text-cyan-300">{roomCode}</span>
          </p>
          <p className="mt-1 text-sm text-slate-400">
            Current Turn: {currentTurnName}
          </p>
        </div>

        <div className="flex gap-2">
          <Button variant="danger" onClick={handleLeaveGame} disabled={leaving}>
            {leaving ? 'Leaving...' : 'Leave Game'}
          </Button>

          <Link to={`/game/${roomCode}/guess`}>
            <Button disabled={isEliminated || !isPlaying}>Make Guess</Button>
          </Link>
        </div>
      </div>

      {isSetupPhase ? (
        <div className="mt-4 rounded-2xl border border-cyan-400/40 bg-cyan-950/20 p-4">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div className="max-w-2xl">
              <h2 className="text-xl font-black text-cyan-200">
                Pick starting clues
              </h2>
              <p className="mt-2 text-sm text-slate-300">
                You are choosing one YES clue and one NO clue for{' '}
                <span className="font-black text-white">
                  {setupReceiver?.name ?? 'the next player'}
                </span>
                . Pick both cards from your hand. The app checks that the YES
                card really matches their hidden identity and the NO card does
                not.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:min-w-[520px]">
              <label className="grid gap-2 text-sm font-bold text-slate-300">
                YES clue
                <select
                  value={setupYesCardId}
                  onChange={(event) => setSetupYesCardId(event.target.value)}
                  className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-3 text-slate-100"
                  disabled={busy}
                >
                  <option value="">Choose a YES card</option>
                  {playerState?.hand.map((card) => (
                    <option key={`yes-${card.id}`} value={card.id}>
                      {describeCard(card)}
                    </option>
                  ))}
                </select>
              </label>

              <label className="grid gap-2 text-sm font-bold text-slate-300">
                NO clue
                <select
                  value={setupNoCardId}
                  onChange={(event) => setSetupNoCardId(event.target.value)}
                  className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-3 text-slate-100"
                  disabled={busy}
                >
                  <option value="">Choose a NO card</option>
                  {playerState?.hand.map((card) => (
                    <option key={`no-${card.id}`} value={card.id}>
                      {describeCard(card)}
                    </option>
                  ))}
                </select>
              </label>

              <Button
                onClick={handleSubmitInitialClues}
                disabled={
                  busy ||
                  !setupYesCardId ||
                  !setupNoCardId ||
                  setupYesCardId === setupNoCardId
                }
              >
                {busy ? 'Submitting...' : 'Submit Starting Clues'}
              </Button>
            </div>
          </div>

          {setupReceiverIdentity ? (
            <div className="mt-4 max-w-xs">
              <CardView
                card={setupReceiverIdentity.hiddenIdentity}
                label={`${setupReceiver?.name ?? 'Player'} identity`}
              />
            </div>
          ) : null}
        </div>
      ) : null}

      {room?.pendingReveal ? (
        <div className="mt-4 rounded-2xl border border-amber-400/50 bg-amber-950/20 p-4">
          <div className="max-w-sm">
            <CardView card={room.pendingReveal.card} label="Revealed to group" />
          </div>
          <p className="mt-3 text-sm text-amber-100">
            This room has a pending manual response, but the temporary safe UI
            has manual answer buttons disabled to prevent the white screen.
          </p>
        </div>
      ) : null}

      <div className="mt-4 rounded-2xl border border-slate-800 bg-slate-900 p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-bold">
              {isSetupPhase
                ? 'Waiting for everyone to submit starting clues'
                : isEliminated
                  ? 'You are eliminated'
                  : isYourTurn
                    ? 'Your turn'
                    : `Waiting for ${currentTurnName}`}
            </p>
            <p className="text-sm text-slate-400">
              {isSetupPhase
                ? 'The regular turn order starts after all players submit.'
                : 'Select a card from your hand, then reveal it.'}
            </p>
          </div>

          <Button
            onClick={handleRevealCard}
            disabled={!isYourTurn || isEliminated || !selectedCardId || busy}
          >
            {busy ? 'Revealing...' : 'Reveal Selected Card'}
          </Button>
        </div>

        {message ? (
          <p className="mt-3 rounded-xl border border-emerald-500/40 bg-emerald-950/30 px-4 py-3 text-sm text-emerald-200">
            {message}
          </p>
        ) : null}

        {error ? (
          <p className="mt-3 rounded-xl border border-rose-500/50 bg-rose-950/40 px-4 py-3 text-sm text-rose-200">
            {error}
          </p>
        ) : null}
      </div>

      <div className="mt-6 grid gap-4 xl:grid-cols-[2fr_1fr_1fr]">
        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
          <h2 className="font-bold">Your Hand</h2>

          <div className="mt-4 grid gap-3 sm:grid-cols-2 2xl:grid-cols-3">
            {playerState?.hand.map((card) => {
              const selected = selectedCardId === card.id

              return (
                <button
                  key={card.id}
                  type="button"
                  onClick={() => setSelectedCardId(card.id)}
                  disabled={!isYourTurn || isEliminated || busy}
                  className={`rounded-2xl text-left transition ${
                    selected
                      ? 'ring-2 ring-cyan-300'
                      : 'ring-1 ring-transparent'
                  } disabled:cursor-not-allowed disabled:opacity-70`}
                >
                  <CardView card={card} />
                </button>
              )
            })}

            {!playerState ? (
              <p className="text-sm text-slate-400">Loading your cards...</p>
            ) : null}
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
            <h2 className="font-bold">Your Clues</h2>

            <div className="mt-4 rounded-xl bg-slate-950 p-4">
              <p className="text-sm text-slate-400">Wrong guesses</p>
              <p className="text-2xl font-black text-amber-300">
                {playerState?.wrongGuesses ?? 0}/3
              </p>
              {isEliminated ? (
                <p className="mt-1 text-sm font-semibold text-rose-300">
                  Eliminated
                </p>
              ) : null}
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-slate-950 p-4">
                <p className="text-sm text-slate-400">YES pile</p>
                <p className="text-3xl font-black text-emerald-300">
                  {playerState?.hideYesPile
                    ? 'Hidden'
                    : (playerState?.yesPile.length ?? 0)}
                </p>
              </div>

              <div className="rounded-xl bg-slate-950 p-4">
                <p className="text-sm text-slate-400">NO pile</p>
                <p className="text-3xl font-black text-rose-300">
                  {playerState?.hideNoPile
                    ? 'Hidden'
                    : (playerState?.noPile.length ?? 0)}
                </p>
              </div>
            </div>

            <div className="mt-4 space-y-3">
              {!playerState?.hideYesPile
                ? playerState?.yesPile.map((card) => (
                    <CardView key={`yes-${card.id}`} card={card} label="YES" />
                  ))
                : null}

              {!playerState?.hideNoPile
                ? playerState?.noPile.map((card) => (
                    <CardView key={`no-${card.id}`} card={card} label="NO" />
                  ))
                : null}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
            <h2 className="font-bold">Other Identities</h2>

            <div className="mt-4 space-y-3">
              {visibleIdentities.map((identity) => (
                <CardView
                  key={identity.playerId}
                  card={identity.hiddenIdentity}
                  label={playerNameById.get(identity.playerId) ?? 'Player'}
                />
              ))}

              {visibleIdentities.length === 0 ? (
                <p className="text-sm text-slate-400">
                  Waiting for other player identities...
                </p>
              ) : null}
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
            <h2 className="font-bold">Players</h2>

            <div className="mt-4 space-y-3">
              {players.map((player) => {
                const isCurrentTurn = room?.currentTurnPlayerId === player.id
                const eliminated = player.eliminated ?? false
                const wrongGuesses = player.wrongGuesses ?? 0

                return (
                  <div
                    key={player.id}
                    className="rounded-xl border border-slate-800 bg-slate-950 p-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-semibold">
                          {player.name}{' '}
                          {player.id === user?.uid ? (
                            <span className="text-cyan-300">(You)</span>
                          ) : null}
                        </p>
                        <p className="text-xs text-slate-400">
                          {player.isHost ? 'Host' : 'Player'}
                        </p>
                      </div>

                      <span
                        className={`rounded-full px-2 py-1 text-xs font-bold ${
                          eliminated
                            ? 'bg-rose-400 text-slate-950'
                            : isCurrentTurn
                              ? 'bg-cyan-300 text-slate-950'
                              : 'bg-slate-800 text-slate-300'
                        }`}
                      >
                        {eliminated
                          ? 'Eliminated'
                          : isCurrentTurn
                            ? 'Turn'
                            : 'Active'}
                      </span>
                    </div>

                    <p className="mt-2 text-sm text-slate-400">
                      Wrong guesses: {wrongGuesses}/3
                    </p>
                  </div>
                )
              })}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
            <h2 className="font-bold">Game Log</h2>

            <div className="mt-4 space-y-3">
              {gameLog.map((entry) => (
                <div key={entry.id} className="rounded-xl bg-slate-950 p-3">
                  <p className="text-sm text-slate-300">{entry.message}</p>
                </div>
              ))}

              {gameLog.length === 0 ? (
                <p className="text-sm text-slate-400">No game log yet.</p>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
