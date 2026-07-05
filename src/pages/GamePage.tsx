import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { CardView } from '../components/game/CardView'
import { RoomShareBox } from '../components/room/RoomShareBox'
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
} from '../firebase/rooms'
import type { PlayerGameState, PlayerIdentityDoc } from '../types/game'
import type { GameLogEntry } from '../types/log'
import type { LobbyPlayer, RoomDoc } from '../types/room'

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

  const isYourTurn = room?.currentTurnPlayerId === user?.uid
  const isEliminated = playerState?.eliminated ?? false

  const currentTurnName = useMemo(() => {
    const currentPlayer = players.find(
      (player) => player.id === room?.currentTurnPlayerId,
    )

    return currentPlayer?.name ?? 'Unknown'
  }, [players, room?.currentTurnPlayerId])

  const visibleIdentities = useMemo(
    () => identities.filter((identity) => identity.playerId !== user?.uid),
    [identities, user?.uid],
  )

  const playerNameById = useMemo(() => {
    return new Map(players.map((player) => [player.id, player.name]))
  }, [players])

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

      setMessage(`Card revealed. Result: ${result}.`)
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
            <Button disabled={isEliminated}>Make Guess</Button>
          </Link>
        </div>
      </div>

      <div className="mt-4 rounded-2xl border border-slate-800 bg-slate-900 p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-bold">
              {isEliminated
                ? 'You are eliminated'
                : isYourTurn
                  ? 'Your turn'
                  : `Waiting for ${currentTurnName}`}
            </p>
            <p className="text-sm text-slate-400">
              Select a card from your hand, then reveal it.
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
          <RoomShareBox roomCode={roomCode} />

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
