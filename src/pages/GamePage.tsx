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
    'table' | 'hand' | 'yesPile' | 'noPile' | 'identities' | 'player' | null
  >(null)
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null)
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

  const selectedPlayer = useMemo(() => {
    if (!selectedPlayerId) return null

    return players.find((player) => player.id === selectedPlayerId) ?? null
  }, [players, selectedPlayerId])

  const selectedPlayerIdentity = useMemo(() => {
    if (!selectedPlayerId) return null

    return identities.find((identity) => identity.playerId === selectedPlayerId) ?? null
  }, [identities, selectedPlayerId])

  const selectedPlayerIsYou = selectedPlayerId === user?.uid

  const openPanelTitle =
    openPanel === 'table'
      ? 'Table view'
      : openPanel === 'hand'
        ? 'Your cards'
        : openPanel === 'yesPile'
          ? 'Your YES pile'
          : openPanel === 'noPile'
            ? 'Your NO pile'
            : openPanel === 'identities'
              ? 'Other identities'
              : openPanel === 'player'
                ? `${selectedPlayer?.name ?? 'Player'} board`
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
    <section className="mx-auto flex min-h-screen max-w-7xl flex-col gap-4 px-4 py-4 lg:h-screen lg:overflow-hidden">
      <header className="flex shrink-0 flex-col gap-3 rounded-[2rem] border border-slate-800 bg-slate-950/90 p-4 shadow-2xl shadow-slate-950/40 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.28em] text-cyan-300">
            Deduction table
          </p>
          <h1 className="mt-1 text-2xl font-black sm:text-3xl">Room {roomCode}</h1>
          <p className="mt-1 text-sm text-slate-400">
            One-screen board · players on the rail · recent turn in the center
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Link to={`/game/${roomCode}/guess`}>
            <Button disabled={isEliminated || !isPlaying}>Make Guess</Button>
          </Link>
          <Button variant="danger" onClick={handleLeaveGame} disabled={leaving}>
            {leaving ? 'Leaving...' : 'Leave Game'}
          </Button>
        </div>
      </header>

      <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[220px_minmax(0,1fr)_260px]">
        <aside className="min-h-0 rounded-[2rem] border border-slate-800 bg-slate-900/95 p-4 lg:overflow-y-auto">
          <div className="flex items-center justify-between gap-2 lg:block">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">
                Players
              </p>
              <h2 className="mt-1 font-black text-slate-100">Side rail</h2>
            </div>
            <span className="rounded-full bg-slate-950 px-3 py-1 text-xs font-black text-slate-300 lg:mt-2 lg:inline-flex">
              {players.length} seated
            </span>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
            {players.map((player) => {
              const isCurrentTurn = room?.currentTurnPlayerId === player.id
              const eliminated = player.eliminated ?? false
              const wrongGuesses = player.wrongGuesses ?? 0

              return (
                <button
                  key={player.id}
                  type="button"
                  onClick={() => {
                    setSelectedPlayerId(player.id)
                    setOpenPanel('player')
                  }}
                  className={`rounded-2xl border p-3 text-left transition hover:-translate-y-0.5 hover:border-cyan-300/70 ${
                    isCurrentTurn
                      ? 'border-cyan-300 bg-cyan-950/40 shadow-lg shadow-cyan-950/40'
                      : eliminated
                        ? 'border-rose-400/50 bg-rose-950/20'
                        : 'border-slate-800 bg-slate-950'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-black text-slate-100">
                        {player.name}{' '}
                        {player.id === user?.uid ? (
                          <span className="text-cyan-300">(You)</span>
                        ) : null}
                      </p>
                      <p className="text-xs text-slate-400">
                        {player.isHost ? 'Host' : 'Player'} · {wrongGuesses}/3 wrong
                      </p>
                    </div>
                    <span
                      className={`rounded-full px-2 py-1 text-[0.65rem] font-black uppercase ${
                        eliminated
                          ? 'bg-rose-300 text-slate-950'
                          : isCurrentTurn
                            ? 'bg-cyan-300 text-slate-950'
                            : 'bg-slate-800 text-slate-300'
                      }`}
                    >
                      {eliminated ? 'Out' : isCurrentTurn ? 'Turn' : 'In'}
                    </span>
                  </div>
                </button>
              )
            })}
          </div>
        </aside>

        <main className="min-h-0 rounded-[2.5rem] border border-cyan-300/30 bg-gradient-to-br from-slate-900 via-slate-950 to-cyan-950/40 p-4 shadow-2xl shadow-cyan-950/30 lg:overflow-hidden">
          <div className="flex h-full min-h-[560px] flex-col gap-4 lg:min-h-0">
            <div className="grid flex-1 gap-4 lg:grid-cols-[1fr_280px] lg:overflow-hidden">
              <section className="flex min-h-[360px] flex-col justify-center rounded-[2rem] border border-cyan-300/20 bg-slate-950/70 p-5 text-center">
                <p className="text-xs font-black uppercase tracking-[0.3em] text-cyan-300">
                  Recent turn
                </p>
                <h2 className="mt-3 text-4xl font-black text-white sm:text-5xl">
                  {currentTurnName}
                </h2>
                <p className="mt-3 text-sm text-slate-400">
                  Table turn {room?.turnNumber ?? 0} ·{' '}
                  {isSetupPhase
                    ? 'Setup clues are being chosen'
                    : room?.pendingReveal
                      ? 'Waiting on a reveal answer'
                      : room?.lastReveal
                        ? `Latest reveal was ${room.lastReveal.result}`
                        : room?.publicGuesses?.length
                          ? 'Latest guess is recorded'
                          : 'No table moves yet'}
                </p>

                <div className="mx-auto mt-6 w-full max-w-sm rounded-[2rem] border border-slate-700 bg-slate-900/90 p-4 text-left">
                  {room?.pendingReveal ? (
                    <div>
                      <p className="text-sm font-black text-amber-200">
                        {playerNameById.get(room.pendingReveal.playerId) ?? 'A player'} revealed
                      </p>
                      <div className="mt-3 max-w-[240px]">
                        <CardView card={room.pendingReveal.card} label="Waiting" />
                      </div>
                      <p className="mt-3 text-sm text-amber-100">
                        Waiting for {playerNameById.get(room.pendingReveal.responderId) ?? 'another player'}.
                      </p>
                    </div>
                  ) : room?.lastReveal ? (
                    <div>
                      <p className="text-sm font-black text-slate-200">
                        {room.lastReveal.playerName} revealed
                      </p>
                      <div className="mt-3 max-w-[240px]">
                        <CardView card={room.lastReveal.card} label={room.lastReveal.result} />
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
                    <p className="text-sm text-slate-400">The table is waiting for its first move.</p>
                  )}
                </div>

                <div className="mt-5 flex flex-wrap justify-center gap-2">
                  <Button
                    onClick={handleRevealCard}
                    disabled={!isYourTurn || isEliminated || !selectedCardId || busy}
                  >
                    {busy ? 'Revealing...' : 'Reveal Selected Card'}
                  </Button>
                  <Button variant="secondary" onClick={() => setOpenPanel('table')}>
                    Table History
                  </Button>
                </div>

                <p className="mt-4 text-sm font-semibold text-slate-300">
                  {isSetupPhase
                    ? 'Waiting for everyone to submit starting clues.'
                    : isEliminated
                      ? 'You are eliminated.'
                      : isYourTurn
                        ? 'Your turn.'
                        : `Waiting for ${currentTurnName}.`}
                </p>
              </section>

              <section className="min-h-0 space-y-3 overflow-y-auto rounded-[2rem] border border-slate-800 bg-slate-900/80 p-4">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">
                    Around the board
                  </p>
                  <h2 className="mt-1 font-black text-slate-100">Quick buttons</h2>
                </div>

                <div className="grid gap-3">
                  <button
                    type="button"
                    onClick={() => setOpenPanel('hand')}
                    disabled={!playerState || isEliminated || busy}
                    className="rounded-2xl border border-slate-700 bg-slate-950/80 p-4 text-left transition hover:border-cyan-300 disabled:opacity-50"
                  >
                    <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">
                      Hand
                    </p>
                    <p className="mt-2 text-3xl font-black text-cyan-300">
                      {playerState?.hand.length ?? 0}
                    </p>
                    <p className="mt-1 text-xs text-slate-400">
                      {selectedCardId ? 'Card selected' : 'Click to choose reveal card'}
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setOpenPanel('yesPile')}
                    disabled={!playerState || playerState.hideYesPile}
                    className="rounded-2xl border border-slate-700 bg-slate-950/80 p-4 text-left transition hover:border-emerald-300 disabled:opacity-50"
                  >
                    <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">
                      YES pile
                    </p>
                    <p className="mt-2 text-3xl font-black text-emerald-300">
                      {playerState?.hideYesPile ? 'Hidden' : (playerState?.yesPile.length ?? 0)}
                    </p>
                    <p className="mt-1 text-xs text-slate-400">Your confirmed clues</p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setOpenPanel('noPile')}
                    disabled={!playerState || playerState.hideNoPile}
                    className="rounded-2xl border border-slate-700 bg-slate-950/80 p-4 text-left transition hover:border-rose-300 disabled:opacity-50"
                  >
                    <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">
                      NO pile
                    </p>
                    <p className="mt-2 text-3xl font-black text-rose-300">
                      {playerState?.hideNoPile ? 'Hidden' : (playerState?.noPile.length ?? 0)}
                    </p>
                    <p className="mt-1 text-xs text-slate-400">Your eliminated clues</p>
                  </button>
                </div>

                <Button
                  variant="secondary"
                  onClick={() => setOpenPanel('identities')}
                  disabled={visibleIdentities.length === 0}
                  className="w-full"
                >
                  Other Identities
                </Button>

                <div className="rounded-2xl bg-slate-950 p-4">
                  <p className="text-sm text-slate-400">Wrong guesses</p>
                  <p className="mt-1 text-3xl font-black text-amber-300">
                    {playerState?.wrongGuesses ?? 0}/3
                  </p>
                  {isEliminated ? (
                    <p className="mt-1 text-sm font-semibold text-rose-300">Eliminated</p>
                  ) : null}
                </div>

                {message ? (
                  <p className="rounded-xl border border-emerald-500/40 bg-emerald-950/30 px-4 py-3 text-sm text-emerald-200">
                    {message}
                  </p>
                ) : null}

                {error ? (
                  <p className="rounded-xl border border-rose-500/50 bg-rose-950/40 px-4 py-3 text-sm text-rose-200">
                    {error}
                  </p>
                ) : null}

                <div className="rounded-2xl bg-slate-950 p-4">
                  <h3 className="font-black">Latest log</h3>
                  <div className="mt-3 space-y-2">
                    {gameLog.slice(0, 4).map((entry) => (
                      <p key={entry.id} className="rounded-xl bg-slate-900 px-3 py-2 text-sm text-slate-300">
                        {entry.message}
                      </p>
                    ))}
                    {gameLog.length === 0 ? (
                      <p className="text-sm text-slate-400">No game log yet.</p>
                    ) : null}
                  </div>
                </div>
              </section>
            </div>
          </div>
        </main>
      </div>

      {isSetupPhase ? (
        <div className="shrink-0 rounded-2xl border border-cyan-400/40 bg-cyan-950/20 p-4">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div className="max-w-2xl">
              <h2 className="text-xl font-black text-cyan-200">Pick starting clues</h2>
              <p className="mt-2 text-sm text-slate-300">
                You are choosing one YES clue and one NO clue for{' '}
                <span className="font-black text-white">
                  {setupReceiver?.name ?? 'the next player'}
                </span>
                . Pick both cards from your hand. The app checks that the YES card really matches their hidden identity and the NO card does not.
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
                disabled={busy || !setupYesCardId || !setupNoCardId || setupYesCardId === setupNoCardId}
              >
                {busy ? 'Submitting...' : 'Submit Starting Clues'}
              </Button>
            </div>
          </div>

          {setupReceiverIdentity ? (
            <div className="mt-4 max-w-xs">
              <CardView card={setupReceiverIdentity.hiddenIdentity} label={`${setupReceiver?.name ?? 'Player'} identity`} />
            </div>
          ) : null}
        </div>
      ) : null}

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
                    : openPanel === 'player'
                      ? 'Player boards show only information visible to you.'
                      : 'These are the cards currently visible to you.'}
                </p>
              </div>
              <Button
                variant="secondary"
                onClick={() => {
                  setOpenPanel(null)
                  setSelectedPlayerId(null)
                }}
              >
                Close
              </Button>
            </div>

            {openPanel === 'table' ? (
              <div className="mt-5 grid gap-4 lg:grid-cols-2">
                <div className="rounded-2xl border border-slate-700 bg-slate-950/70 p-4">
                  <h3 className="font-black text-slate-100">Recent reveals</h3>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    {room?.publicReveals?.map((reveal, index) => (
                      <div key={`${reveal.playerId}-${reveal.card.id}-${index}`} className="rounded-2xl border border-slate-800 bg-slate-900/80 p-3">
                        <p className="mb-2 text-xs font-black uppercase tracking-[0.18em] text-slate-400">
                          {index === 0 ? 'Latest' : `Move ${index + 1}`}
                        </p>
                        <CardView card={reveal.card} label={reveal.result} />
                        <p className="mt-2 text-sm font-semibold text-slate-300">{reveal.playerName}</p>
                      </div>
                    ))}
                    {!room?.publicReveals?.length ? <p className="text-sm text-slate-400">No reveals yet.</p> : null}
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-700 bg-slate-950/70 p-4">
                  <h3 className="font-black text-slate-100">Recent guesses</h3>
                  <div className="mt-4 space-y-3">
                    {room?.publicGuesses?.map((guess, index) => (
                      <div key={`${guess.playerId}-${guess.turnNumber}-${index}`} className="rounded-2xl border border-slate-800 bg-slate-900/80 p-3">
                        <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">
                          Turn {guess.turnNumber}{index === 0 ? ' · Latest guess' : ''}
                        </p>
                        <p className="mt-1 font-semibold text-slate-200">
                          {guess.playerName} guessed {describeCard(guess.guess)}
                        </p>
                        <span
                          className={`mt-3 inline-flex rounded-full px-3 py-1 text-xs font-black ${
                            guess.correct ? 'bg-emerald-300 text-slate-950' : 'bg-rose-300 text-slate-950'
                          }`}
                        >
                          {guess.correct ? 'Correct' : 'Wrong'}
                        </span>
                      </div>
                    ))}
                    {!room?.publicGuesses?.length ? <p className="text-sm text-slate-400">No guesses yet.</p> : null}
                  </div>
                </div>
              </div>
            ) : openPanel === 'player' ? (
              <div className="mt-5 grid gap-4 lg:grid-cols-3">
                <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4">
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">Status</p>
                  <p className="mt-2 text-2xl font-black text-slate-100">{selectedPlayer?.name ?? 'Player'}</p>
                  <p className="mt-2 text-sm text-slate-400">
                    {selectedPlayer?.isHost ? 'Host' : 'Player'} · {selectedPlayer?.wrongGuesses ?? 0}/3 wrong guesses
                  </p>
                  <p className="mt-3 inline-flex rounded-full bg-slate-800 px-3 py-1 text-xs font-black text-slate-300">
                    {selectedPlayer?.eliminated ? 'Eliminated' : room?.currentTurnPlayerId === selectedPlayer?.id ? 'Current turn' : 'Active'}
                  </p>
                </div>

                <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4 lg:col-span-2">
                  <h3 className="font-black">Identity</h3>
                  <div className="mt-3 max-w-xs">
                    {selectedPlayerIsYou ? (
                      <p className="rounded-xl border border-slate-800 bg-slate-900 p-4 text-sm text-slate-400">
                        Your own hidden identity stays hidden until the game ends.
                      </p>
                    ) : selectedPlayerIdentity ? (
                      <CardView card={selectedPlayerIdentity.hiddenIdentity} label={selectedPlayer?.name ?? 'Player'} />
                    ) : (
                      <p className="text-sm text-slate-400">No visible identity card for this player yet.</p>
                    )}
                  </div>
                </div>

                <div className="rounded-2xl border border-emerald-400/30 bg-emerald-950/20 p-4">
                  <h3 className="font-black text-emerald-200">YES cards</h3>
                  {selectedPlayerIsYou && !playerState?.hideYesPile ? (
                    <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
                      {playerState?.yesPile.map((card) => <CardView key={card.id} card={card} label="YES" />)}
                      {playerState?.yesPile.length === 0 ? <p className="text-sm text-slate-400">No YES cards yet.</p> : null}
                    </div>
                  ) : (
                    <p className="mt-3 text-sm text-slate-400">This pile is not visible from your current player view.</p>
                  )}
                </div>

                <div className="rounded-2xl border border-rose-400/30 bg-rose-950/20 p-4">
                  <h3 className="font-black text-rose-200">NO cards</h3>
                  {selectedPlayerIsYou && !playerState?.hideNoPile ? (
                    <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
                      {playerState?.noPile.map((card) => <CardView key={card.id} card={card} label="NO" />)}
                      {playerState?.noPile.length === 0 ? <p className="text-sm text-slate-400">No NO cards yet.</p> : null}
                    </div>
                  ) : (
                    <p className="mt-3 text-sm text-slate-400">This pile is not visible from your current player view.</p>
                  )}
                </div>

                <div className="rounded-2xl border border-cyan-400/30 bg-cyan-950/20 p-4">
                  <h3 className="font-black text-cyan-200">Cards in hand</h3>
                  {selectedPlayerIsYou ? (
                    <p className="mt-3 text-sm text-slate-300">Open the Hand button on the board to choose one of your {playerState?.hand.length ?? 0} cards.</p>
                  ) : (
                    <p className="mt-3 text-sm text-slate-400">Other players’ hands are private.</p>
                  )}
                </div>
              </div>
            ) : openPanel === 'identities' ? (
              <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {visibleIdentities.map((identity) => (
                  <CardView key={identity.playerId} card={identity.hiddenIdentity} label={playerNameById.get(identity.playerId) ?? 'Player'} />
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
                      className={`rounded-2xl text-left transition ${selected ? 'ring-2 ring-cyan-300' : 'ring-1 ring-transparent'} disabled:cursor-default disabled:opacity-100`}
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

                {openPanelCards.length === 0 ? <p className="text-sm text-slate-400">No cards to show.</p> : null}
              </div>
            )}
          </div>
        </div>
      ) : null}
    </section>
  )
}
