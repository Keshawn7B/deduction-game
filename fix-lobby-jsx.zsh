#!/usr/bin/env zsh
set -e

cd ~/deduction-game

cat > src/pages/LobbyPage.tsx <<'EOF'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { RoomShareBox } from '../components/room/RoomShareBox'
import { Button } from '../components/ui/Button'
import { useAuth } from '../context/AuthContext'
import {
  leaveGame,
  listenToPlayers,
  listenToRoom,
  setPlayerReady,
  startGame,
} from '../firebase/rooms'
import type { LobbyPlayer, RoomDoc } from '../types/room'

export function LobbyPage() {
  const { roomCode = '' } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()

  const [room, setRoom] = useState<RoomDoc | null>(null)
  const [players, setPlayers] = useState<LobbyPlayer[]>([])
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [leaving, setLeaving] = useState(false)

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
    if (room?.status === 'playing') {
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

  const isHost = room?.hostId === user?.uid
  const canStart =
    isHost &&
    players.length >= 2 &&
    players.length <= 4 &&
    players.every((player) => player.ready)

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
    if (!user) {
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
          {leaving ? 'Leaving...' : 'Leave Room'}
        </Button>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-[2fr_1fr]">
        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
          <h2 className="font-bold">Players</h2>

          <div className="mt-4 space-y-3">
            {players.map((player) => (
              <div
                key={player.id}
                className="flex items-center justify-between rounded-xl bg-slate-950 px-4 py-3"
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

                <span
                  className={`rounded-full px-3 py-1 text-sm font-bold ${
                    player.ready
                      ? 'bg-emerald-400 text-slate-950'
                      : 'bg-slate-800 text-slate-300'
                  }`}
                >
                  {player.ready ? 'Ready' : 'Not Ready'}
                </span>
              </div>
            ))}

            {players.length === 0 ? (
              <p className="text-sm text-slate-400">Loading players...</p>
            ) : null}
          </div>
        </div>

        <div className="space-y-4">
          <RoomShareBox roomCode={roomCode} />

          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
            <h2 className="font-bold">Room Controls</h2>

            <div className="mt-4 space-y-3">
              <Button
                variant={currentPlayer?.ready ? 'secondary' : 'primary'}
                onClick={handleToggleReady}
                disabled={!currentPlayer || busy || leaving}
                className="w-full"
              >
                {currentPlayer?.ready ? 'Unready' : 'Ready Up'}
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

              {error ? (
                <p className="rounded-xl border border-rose-500/50 bg-rose-950/40 px-4 py-3 text-sm text-rose-200">
                  {error}
                </p>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
EOF

npm run check

echo ""
echo "Lobby JSX fix complete."
echo "Run: npm run dev"
