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
  const [openPanel, setOpenPanel] = useState<
    'hand' | 'yesPile' | 'noPile' | 'identities' | null
  >(null)
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

  const openPanelTitle =
    openPanel === 'hand'
      ? 'Your cards'
      : openPanel === 'yesPile'
        ? 'Your YES pile'
        : openPanel === 'noPile'
          ? 'Your NO pile'
          : openPanel === 'identities'
            ? 'Other identities'
            : ''

  const openPanelCards =
    openPanel === 'hand'
      ? (playerState?.hand ?? [])
      : openPanel === 'yesPile'
        ? playerState?.hideYesPile
          ? []
          : (playerState?.yesPile ?? [])
        : openPanel === 'noPile'
          ? playerState?.hideNoPile
            ? []
            : (playerState?.noPile ?? [])
          : []

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

      {isPlaying || room?.lastReveal || room?.pendingReveal || room?.publicGuesses?.length ? (
        <div className="mt-5 rounded-[2rem] border border-cyan-300/30 bg-gradient-to-br from-slate-900 via-slate-950 to-cyan-950/30 p-5 shadow-2xl shadow-cyan-950/20">
          <div className="grid gap-5 lg:grid-cols-[1fr_auto_1fr] lg:items-center">
            <div className="rounded-2xl border border-slate-700 bg-slate-950/80 p-4 text-center">
              <p className="text-xs font-black uppercase tracking-[0.28em] text-slate-400">
                Current turn
              </p>
              <p className="mt-2 text-3xl font-black text-cyan-200">
                {currentTurnName}
              </p>
              <p className="mt-1 text-sm text-slate-400">
                Everyone sees this same table state.
              </p>
              <p className="mt-3 inline-flex rounded-full bg-slate-800 px-3 py-1 text-xs font-black uppercase tracking-[0.18em] text-slate-300">
                Table turn {room?.turnNumber ?? 0}
              </p>
            </div>

            <div className="text-center text-sm font-black uppercase tracking-[0.25em] text-slate-500">
              table
            </div>

            <div className="rounded-2xl border border-slate-700 bg-slate-950/80 p-4">
              {room?.pendingReveal ? (
                <div>
                  <p className="text-sm font-black text-amber-200">
                    {playerNameById.get(room.pendingReveal.playerId) ?? 'A player'} revealed this card
                  </p>
                  <div className="mt-3 max-w-[220px]">
                    <CardView card={room.pendingReveal.card} label="Waiting" />
                  </div>
                  <p className="mt-3 text-sm text-amber-100">
                    Waiting for {playerNameById.get(room.pendingReveal.responderId) ?? 'another player'} to answer.
                  </p>
                </div>
              ) : room?.lastReveal ? (
                <div>
                  <p className="text-sm font-black text-slate-200">
                    {room.lastReveal.playerName} revealed this card
                  </p>
                  <div className="mt-3 max-w-[220px]">
                    <CardView
                      card={room.lastReveal.card}
                      label={room.lastReveal.result}
                    />
                  </div>
                  <p
                    className={`mt-3 inline-flex rounded-full px-3 py-1 text-sm font-black ${
                      room.lastReveal.result === 'YES'
                        ? 'bg-emerald-300 text-slate-950'
                        : 'bg-rose-300 text-slate-950'
                    }`}
                  >
                    Result: {room.lastReveal.result}
                  </p>
                </div>
              ) : (
                <p className="text-sm text-slate-400">
                  No card has been revealed yet.
                </p>
              )}
            </div>
          </div>

          {room?.publicReveals?.length ? (
            <div className="mt-5 rounded-2xl border border-slate-700 bg-slate-950/70 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="font-black text-slate-100">Recent table moves</h2>
                  <p className="text-sm text-slate-400">
                    Public reveal trail. Newest move is first.
                  </p>
                </div>
                <span className="rounded-full bg-slate-800 px-3 py-1 text-xs font-black text-slate-300">
                  {room.publicReveals.length} shown
                </span>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {room.publicReveals.map((reveal, index) => (
                  <div
                    key={`${reveal.playerId}-${reveal.card.id}-${index}`}
                    className="rounded-2xl border border-slate-800 bg-slate-900/80 p-3"
                  >
                    <p className="mb-2 text-xs font-black uppercase tracking-[0.18em] text-slate-400">
                      {index === 0 ? 'Latest' : `Move ${index + 1}`}
                    </p>
                    <CardView card={reveal.card} label={reveal.result} />
                    <p className="mt-2 text-sm font-semibold text-slate-300">
                      {reveal.playerName}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {room?.publicGuesses?.length ? (
            <div className="mt-5 rounded-2xl border border-slate-700 bg-slate-950/70 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="font-black text-slate-100">Recent guesses</h2>
                  <p className="text-sm text-slate-400">
                    Public guess trail. Newest guess is first.
                  </p>
                </div>
                <span className="rounded-full bg-slate-800 px-3 py-1 text-xs font-black text-slate-300">
                  {room.publicGuesses.length} shown
                </span>
              </div>

              <div className="mt-4 space-y-3">
                {room.publicGuesses.map((guess, index) => (
                  <div
                    key={`${guess.playerId}-${guess.turnNumber}-${index}`}
                    className="flex flex-col gap-3 rounded-2xl border border-slate-800 bg-slate-900/80 p-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div>
                      <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">
                        Turn {guess.turnNumber}
                        {index === 0 ? ' · Latest guess' : ''}
                      </p>
                      <p className="mt-1 font-semibold text-slate-200">
                        {guess.playerName} guessed {describeCard(guess.guess)}
                      </p>
                    </div>
                    <span
                      className={`self-start rounded-full px-3 py-1 text-xs font-black sm:self-auto ${
                        guess.correct
                          ? 'bg-emerald-300 text-slate-950'
                          : 'bg-rose-300 text-slate-950'
                      }`}
                    >
                      {guess.correct ? 'Correct' : 'Wrong'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

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
          <p className="mt-2 text-sm text-slate-400">
            Keep the table clean. Open your hand when you need to choose a card.
          </p>

          <div className="mt-4 rounded-xl bg-slate-950 p-4">
            <p className="text-sm text-slate-400">Cards in hand</p>
            <p className="text-3xl font-black text-cyan-300">
              {playerState?.hand.length ?? 0}
            </p>
            {selectedCardId ? (
              <p className="mt-2 text-sm font-semibold text-cyan-100">
                Card selected for reveal
              </p>
            ) : null}
          </div>

          <Button
            onClick={() => setOpenPanel('hand')}
            disabled={!playerState || isEliminated || busy}
            className="mt-4 w-full"
          >
            View Cards
          </Button>
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
                <Button
                  variant="secondary"
                  onClick={() => setOpenPanel('yesPile')}
                  disabled={!playerState || playerState.hideYesPile}
                  className="mt-3 w-full"
                >
                  View YES Pile
                </Button>
              </div>

              <div className="rounded-xl bg-slate-950 p-4">
                <p className="text-sm text-slate-400">NO pile</p>
                <p className="text-3xl font-black text-rose-300">
                  {playerState?.hideNoPile
                    ? 'Hidden'
                    : (playerState?.noPile.length ?? 0)}
                </p>
                <Button
                  variant="secondary"
                  onClick={() => setOpenPanel('noPile')}
                  disabled={!playerState || playerState.hideNoPile}
                  className="mt-3 w-full"
                >
                  View NO Pile
                </Button>
              </div>
            </div>

          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
            <h2 className="font-bold">Other Identities</h2>
            <p className="mt-2 text-sm text-slate-400">
              Visible identity cards stay available without crowding the table.
            </p>
            <Button
              variant="secondary"
              onClick={() => setOpenPanel('identities')}
              disabled={visibleIdentities.length === 0}
              className="mt-4 w-full"
            >
              View Other Identities
            </Button>
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

      {openPanel ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4"
          role="dialog"
          aria-modal="true"
          aria-label={openPanelTitle}
        >
          <div className="max-h-[90vh] w-full max-w-5xl overflow-y-auto rounded-3xl border border-slate-700 bg-slate-900 p-5 shadow-2xl">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-2xl font-black">{openPanelTitle}</h2>
                <p className="text-sm text-slate-400">
                  {openPanel === 'hand'
                    ? 'Choose one card here, then reveal it from the main table.'
                    : 'These are the cards currently visible to you.'}
                </p>
              </div>
              <Button variant="secondary" onClick={() => setOpenPanel(null)}>
                Close
              </Button>
            </div>

            {openPanel === 'identities' ? (
              <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {visibleIdentities.map((identity) => (
                  <CardView
                    key={identity.playerId}
                    card={identity.hiddenIdentity}
                    label={playerNameById.get(identity.playerId) ?? 'Player'}
                  />
                ))}
              </div>
            ) : (
              <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {openPanelCards.map((card) => {
                  const selected = selectedCardId === card.id
                  const canSelect = openPanel === 'hand' && isYourTurn && !isEliminated

                  return (
                    <button
                      key={card.id}
                      type="button"
                      onClick={() => {
                        if (!canSelect) return
                        setSelectedCardId(card.id)
                        setOpenPanel(null)
                      }}
                      disabled={!canSelect}
                      className={`rounded-2xl text-left transition ${
                        selected
                          ? 'ring-2 ring-cyan-300'
                          : 'ring-1 ring-transparent'
                      } disabled:cursor-default disabled:opacity-100`}
                    >
                      <CardView
                        card={card}
                        label={
                          openPanel === 'yesPile'
                            ? 'YES'
                            : openPanel === 'noPile'
                              ? 'NO'
                              : selected
                                ? 'Selected'
                                : undefined
                        }
                      />
                    </button>
                  )
                })}

                {openPanelCards.length === 0 ? (
                  <p className="text-sm text-slate-400">No cards to show.</p>
                ) : null}
              </div>
            )}
          </div>
        </div>
      ) : null}
    </section>
  )
}
