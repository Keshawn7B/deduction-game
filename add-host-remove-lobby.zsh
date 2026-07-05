#!/usr/bin/env zsh
set -e

cd ~/deduction-game

python3 - <<'PY'
from pathlib import Path

path = Path("src/firebase/rooms.ts")
text = path.read_text()

if "export async function removePlayerFromLobby(" not in text:
    marker = "export async function resetRoomForRematch("
    if marker not in text:
        marker = "export async function leaveGame("
    if marker not in text:
        raise SystemExit("Could not find insertion marker in src/firebase/rooms.ts")

    function_text = r"""export async function removePlayerFromLobby(params: {
  roomCode: string
  hostId: string
  targetPlayerId: string
}) {
  const roomCode = normalizeRoomCode(params.roomCode)
  const roomRef = doc(db, 'rooms', roomCode)
  const roomSnap = await getDoc(roomRef)

  if (!roomSnap.exists()) {
    throw new Error('Room not found.')
  }

  const room = roomSnap.data() as RoomDoc

  if (room.status !== 'lobby') {
    throw new Error('Players can only be removed before the game starts.')
  }

  if (room.hostId !== params.hostId) {
    throw new Error('Only the host can remove players.')
  }

  if (params.hostId === params.targetPlayerId) {
    throw new Error('Host cannot remove themselves. Use Leave Room instead.')
  }

  const targetPlayerRef = doc(
    db,
    'rooms',
    roomCode,
    'players',
    params.targetPlayerId,
  )
  const targetPlayerSnap = await getDoc(targetPlayerRef)

  if (!targetPlayerSnap.exists()) {
    throw new Error('Player not found.')
  }

  const targetPlayer = targetPlayerSnap.data() as Omit<LobbyPlayer, 'id'>

  const batch = writeBatch(db)

  batch.delete(targetPlayerRef)
  batch.set(doc(collection(db, 'rooms', roomCode, 'log')), {
    message: `${targetPlayer.name} was removed from the lobby by the host.`,
    createdAt: serverTimestamp(),
  })

  await batch.commit()
}

"""
    text = text.replace(marker, function_text + marker)

path.write_text(text)
PY

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
  removePlayerFromLobby,
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
  const [removingPlayerId, setRemovingPlayerId] = useState('')

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

  useEffect(() => {
    if (!user || players.length === 0) return

    const stillInLobby = players.some((player) => player.id === user.uid)

    if (!stillInLobby) {
      navigate('/')
    }
  }, [navigate, players, user])

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
          {leaving ? 'Leaving...' : 'Leave Room'}
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
        </div>
      </div>
    </section>
  )
}
EOF

npm run check

echo ""
echo "Host remove-from-lobby patch complete."
echo "Run: npm run dev"
