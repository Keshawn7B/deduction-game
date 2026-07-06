import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { RoomShareBox } from '../components/room/RoomShareBox'
import { Button } from '../components/ui/Button'
import { useAuth } from '../context/AuthContext'
import { CARD_SET_SIZES } from '../game/deck'
import type { StartingCluesMode } from '../game/setup'
import type { CardSetSize } from '../types/card'
import {
  joinRoom,
  leaveGame,
  listenToPlayers,
  listenToRoom,
  removePlayerFromLobby,
  setPlayerReady,
  setRoomCardSetSize,
  setRoomStartingCluesMode,
  startGame,
} from '../firebase/rooms'
import type { LobbyPlayer, RoomDoc } from '../types/room'

export function LobbyPage() {
  const { roomCode = '' } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()

  const [room, setRoom] = useState<RoomDoc | null>(null)
  const [players, setPlayers] = useState<LobbyPlayer[]>([])
  const [joinName, setJoinName] = useState(() =>
    window.localStorage.getItem('deducktionPlayerName') ?? '',
  )
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [joining, setJoining] = useState(false)
  const [leaving, setLeaving] = useState(false)
  const [removingPlayerId, setRemovingPlayerId] = useState('')
  const wasJoinedRef = useRef(false)

  useEffect(() => {
    if (!roomCode) return

    const unsubscribeRoom = listenToRoom(roomCode, setRoom)
    const unsubscribePlayers = listenToPlayers(roomCode, setPlayers)

    return () => {
      unsubscribeRoom()
      unsubscribePlayers()
    }
  }, [roomCode])

  useEffect(() => {
    if (room?.status === 'playing' || room?.status === 'setupClues') {
      navigate(`/game/${roomCode}`)
    }

    if (room?.status === 'finished') {
      navigate(`/winner/${roomCode}`)
    }
  }, [navigate, room?.status, roomCode])

  const currentPlayer = useMemo(
    () => players.find((player) => player.id === user?.uid) ?? null,
    [players, user?.uid],
  )

  useEffect(() => {
    if (currentPlayer) {
      wasJoinedRef.current = true
      return
    }

    if (wasJoinedRef.current && room?.status === 'lobby') {
      navigate('/')
    }
  }, [currentPlayer, navigate, room?.status])

  const isHost = room?.hostId === user?.uid
  const selectedCardSetSize = room?.cardSetSize ?? 8
  const selectedStartingCluesMode = room?.startingCluesMode ?? 'automatic'
  const canStart =
    isHost &&
    players.length >= 2 &&
    players.length <= 4 &&
    players.every((player) => player.ready)

  async function handleJoinFromLink() {
    if (!user) {
      setError('You are not signed in yet.')
      return
    }

    setJoining(true)
    setError('')

    try {
      await joinRoom({
        roomCode,
        playerId: user.uid,
        playerName: joinName,
      })

      window.localStorage.setItem('deducktionPlayerName', joinName.trim())
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Could not join room.')
    } finally {
      setJoining(false)
    }
  }

  async function handleToggleReady() {
    if (!user || !currentPlayer) return

    setError('')

    try {
      await setPlayerReady({
        roomCode,
        playerId: user.uid,
        ready: !currentPlayer.ready,
      })
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Could not update ready.')
    }
  }

  async function runHostOptionUpdate(
    action: () => Promise<void>,
    fallbackMessage: string,
  ) {
    if (!user || !isHost) return

    setError('')
    setBusy(true)

    try {
      await action()
    } catch (error) {
      setError(error instanceof Error ? error.message : fallbackMessage)
    } finally {
      setBusy(false)
    }
  }

  async function handleCardSetSizeChange(cardSetSize: CardSetSize) {
    await runHostOptionUpdate(
      () =>
        setRoomCardSetSize({
          roomCode,
          hostId: user!.uid,
          cardSetSize,
        }),
      'Could not update card options.',
    )
  }

  async function handleStartingCluesModeChange(
    startingCluesMode: StartingCluesMode,
  ) {
    await runHostOptionUpdate(
      () =>
        setRoomStartingCluesMode({
          roomCode,
          hostId: user!.uid,
          startingCluesMode,
        }),
      'Could not update starting clue options.',
    )
  }

  async function handleStartGame() {
    if (!user || !canStart) return

    setError('')
    setBusy(true)

    try {
      await startGame({
        roomCode,
        hostId: user.uid,
      })

      navigate(`/game/${roomCode}`)
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Could not start game.')
    } finally {
      setBusy(false)
    }
  }

  async function handleLeaveRoom() {
    if (!user || !currentPlayer) {
      navigate('/')
      return
    }

    setLeaving(true)
    setError('')

    try {
      await leaveGame({
        roomCode,
        playerId: user.uid,
      })

      navigate('/')
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Could not leave room.')
    } finally {
      setLeaving(false)
    }
  }

  async function handleRemovePlayer(targetPlayer: LobbyPlayer) {
    if (!user || !isHost) return

    const confirmed = window.confirm(
      `Remove ${targetPlayer.name} from this lobby?`,
    )

    if (!confirmed) return

    setRemovingPlayerId(targetPlayer.id)
    setError('')

    try {
      await removePlayerFromLobby({
        roomCode,
        hostId: user.uid,
        targetPlayerId: targetPlayer.id,
      })
    } catch (error) {
      setError(
        error instanceof Error ? error.message : 'Could not remove player.',
      )
    } finally {
      setRemovingPlayerId('')
    }
  }

  return (
    <section className="mx-auto min-h-screen max-w-5xl px-4 py-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-black">Lobby</h1>
          <p className="mt-2 text-slate-300">
            Room Code:{' '}
            <span className="font-mono text-xl font-black text-cyan-300">
              {roomCode}
            </span>
          </p>
        </div>

        <Button variant="secondary" onClick={handleLeaveRoom} disabled={leaving}>
          {currentPlayer
            ? leaving
              ? 'Leaving...'
              : 'Leave Room'
            : 'Return Home'}
        </Button>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-[2fr_1fr]">
        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
          <h2 className="font-bold">Players</h2>

          <div className="mt-4 space-y-3">
            {players.map((player) => {
              const canRemovePlayer =
                isHost && player.id !== user?.uid && !player.isHost

              return (
                <div
                  key={player.id}
                  className="flex flex-col gap-3 rounded-xl bg-slate-950 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <p className="font-semibold">
                      {player.name}{' '}
                      {player.id === user?.uid ? (
                        <span className="text-cyan-300">(You)</span>
                      ) : null}
                    </p>
                    <p className="text-sm text-slate-400">
                      {player.isHost ? 'Host' : 'Player'}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`rounded-full px-3 py-1 text-sm font-bold ${
                        player.ready
                          ? 'bg-emerald-400 text-slate-950'
                          : 'bg-slate-800 text-slate-300'
                      }`}
                    >
                      {player.ready ? 'Ready' : 'Not Ready'}
                    </span>

                    {canRemovePlayer ? (
                      <Button
                        variant="danger"
                        onClick={() => handleRemovePlayer(player)}
                        disabled={removingPlayerId === player.id || busy}
                      >
                        {removingPlayerId === player.id ? 'Removing...' : 'Remove'}
                      </Button>
                    ) : null}
                  </div>
                </div>
              )
            })}

            {players.length === 0 ? (
              <p className="text-sm text-slate-400">Loading players...</p>
            ) : null}
          </div>
        </div>

        <div className="space-y-4">
          <RoomShareBox roomCode={roomCode} />

          {!currentPlayer ? (
            <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
              <h2 className="font-bold">Join This Room</h2>

              <div className="mt-4 space-y-3">
                <input
                  value={joinName}
                  onChange={(event) => setJoinName(event.target.value)}
                  placeholder="Your name"
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 outline-none focus:border-cyan-300"
                />

                <Button
                  onClick={handleJoinFromLink}
                  disabled={!joinName.trim() || joining}
                  className="w-full"
                >
                  {joining ? 'Joining...' : 'Join Room'}
                </Button>

                <p className="text-sm text-slate-400">
                  You opened a room link. Enter your name to join this lobby.
                </p>

                {error ? (
                  <p className="rounded-xl border border-rose-500/50 bg-rose-950/40 px-4 py-3 text-sm text-rose-200">
                    {error}
                  </p>
                ) : null}
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
              <h2 className="font-bold">Room Controls</h2>

              <div className="mt-4 space-y-3">
                <div className="rounded-xl border border-slate-800 bg-slate-950 p-4">
                  <p className="text-sm font-bold text-slate-200">Card Set</p>
                  <p className="mt-1 text-xs text-slate-400">
                    Choose how many animals, disguises, and locations are in the deck.
                  </p>

                  <div className="mt-3 grid grid-cols-3 gap-2">
                    {CARD_SET_SIZES.map((cardSetSize) => {
                      const selected = selectedCardSetSize === cardSetSize

                      return (
                        <Button
                          key={cardSetSize}
                          variant={selected ? 'primary' : 'secondary'}
                          onClick={() => handleCardSetSizeChange(cardSetSize)}
                          disabled={!isHost || busy || leaving || selected}
                          className="w-full"
                        >
                          {cardSetSize}x{cardSetSize}x{cardSetSize}
                        </Button>
                      )
                    })}
                  </div>

                  {!isHost ? (
                    <p className="mt-3 text-xs text-slate-500">
                      Only the host can change this option.
                    </p>
                  ) : null}
                </div>

                <div className="rounded-xl border border-slate-800 bg-slate-950 p-4">
                  <p className="text-sm font-bold text-slate-200">
                    Starting Clues
                  </p>
                  <p className="mt-1 text-xs text-slate-400">
                    Automatic gives each player one YES and one NO clue. Player choice lets each player pick a YES and NO clue for the next player, with at least one valid YES and one valid NO guaranteed in their hand.
                  </p>

                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    {[
                      ['automatic', 'Automatic'],
                      ['playerChoice', 'Players choose'],
                    ].map(([mode, label]) => {
                      const startingCluesMode = mode as StartingCluesMode
                      const selected =
                        selectedStartingCluesMode === startingCluesMode

                      return (
                        <Button
                          key={startingCluesMode}
                          variant={selected ? 'primary' : 'secondary'}
                          onClick={() =>
                            handleStartingCluesModeChange(startingCluesMode)
                          }
                          disabled={!isHost || busy || leaving || selected}
                          className="w-full"
                        >
                          {label}
                        </Button>
                      )
                    })}
                  </div>

                  {!isHost ? (
                    <p className="mt-3 text-xs text-slate-500">
                      Only the host can change this option.
                    </p>
                  ) : null}
                </div>

                <Button
                  variant={currentPlayer.ready ? 'secondary' : 'primary'}
                  onClick={handleToggleReady}
                  disabled={busy || leaving}
                  className="w-full"
                >
                  {currentPlayer.ready ? 'Unready' : 'Ready Up'}
                </Button>

                <Button
                  disabled={!canStart || busy || leaving}
                  onClick={handleStartGame}
                  className="w-full"
                >
                  {busy ? 'Starting...' : 'Start Game'}
                </Button>

                <p className="text-sm text-slate-400">
                  Start Game unlocks after 2–4 players join and everyone is ready.
                </p>

                {isHost ? (
                  <p className="text-sm text-slate-400">
                    As host, you can remove non-host players before the game starts.
                  </p>
                ) : null}

                {error ? (
                  <p className="rounded-xl border border-rose-500/50 bg-rose-950/40 px-4 py-3 text-sm text-rose-200">
                    {error}
                  </p>
                ) : null}
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
