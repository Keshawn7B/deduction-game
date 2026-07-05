#!/usr/bin/env zsh
set -e

cd ~/deduction-game

mkdir -p src/types src/utils src/context src/firebase src/pages

cat > src/types/room.ts <<'EOF'
export type RoomStatus = 'lobby' | 'playing' | 'finished'

export type RoomDoc = {
  roomCode: string
  hostId: string
  status: RoomStatus
  currentTurnPlayerId: string | null
  winnerId: string | null
  createdAt: unknown
}

export type LobbyPlayer = {
  id: string
  name: string
  ready: boolean
  isHost: boolean
  joinedAt: unknown
}
EOF

cat > src/utils/roomCode.ts <<'EOF'
const ROOM_CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

export function createRoomCode(length = 4): string {
  let code = ''

  for (let index = 0; index < length; index += 1) {
    const charIndex = Math.floor(Math.random() * ROOM_CODE_CHARS.length)
    code += ROOM_CODE_CHARS[charIndex]
  }

  return code
}

export function normalizeRoomCode(value: string): string {
  return value.trim().toUpperCase().replace(/[^A-Z0-9]/g, '')
}
EOF

cat > src/context/AuthContext.tsx <<'EOF'
import {
  onAuthStateChanged,
  signInAnonymously,
  type User,
} from 'firebase/auth'
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { auth } from '../firebase/client'

type AuthContextValue = {
  user: User | null
  loading: boolean
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (nextUser) => {
      if (nextUser) {
        setUser(nextUser)
        setLoading(false)
        return
      }

      try {
        const credential = await signInAnonymously(auth)
        setUser(credential.user)
      } finally {
        setLoading(false)
      }
    })

    return unsubscribe
  }, [])

  const value = useMemo(() => ({ user, loading }), [user, loading])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const value = useContext(AuthContext)

  if (!value) {
    throw new Error('useAuth must be used inside AuthProvider.')
  }

  return value
}
EOF

cat > src/main.tsx <<'EOF'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import App from './App'
import { AuthProvider } from './context/AuthContext'
import './styles/index.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <HashRouter>
        <App />
      </HashRouter>
    </AuthProvider>
  </StrictMode>,
)
EOF

cat > src/firebase/rooms.ts <<'EOF'
import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  serverTimestamp,
  setDoc,
  updateDoc,
  type Unsubscribe,
} from 'firebase/firestore'
import type { LobbyPlayer, RoomDoc } from '../types/room'
import { createRoomCode, normalizeRoomCode } from '../utils/roomCode'
import { db } from './client'

const MAX_PLAYERS = 4

export async function createRoom(params: {
  hostId: string
  playerName: string
}): Promise<string> {
  const playerName = params.playerName.trim()

  if (!playerName) {
    throw new Error('Enter a player name.')
  }

  for (let attempt = 0; attempt < 10; attempt += 1) {
    const roomCode = createRoomCode()
    const roomRef = doc(db, 'rooms', roomCode)
    const existingRoom = await getDoc(roomRef)

    if (existingRoom.exists()) {
      continue
    }

    await setDoc(roomRef, {
      roomCode,
      hostId: params.hostId,
      status: 'lobby',
      currentTurnPlayerId: null,
      winnerId: null,
      createdAt: serverTimestamp(),
    })

    await setDoc(doc(db, 'rooms', roomCode, 'players', params.hostId), {
      name: playerName,
      ready: true,
      isHost: true,
      joinedAt: serverTimestamp(),
    })

    return roomCode
  }

  throw new Error('Could not create a unique room code. Try again.')
}

export async function joinRoom(params: {
  roomCode: string
  playerId: string
  playerName: string
}): Promise<string> {
  const roomCode = normalizeRoomCode(params.roomCode)
  const playerName = params.playerName.trim()

  if (!roomCode) {
    throw new Error('Enter a room code.')
  }

  if (!playerName) {
    throw new Error('Enter a player name.')
  }

  const roomRef = doc(db, 'rooms', roomCode)
  const roomSnap = await getDoc(roomRef)

  if (!roomSnap.exists()) {
    throw new Error('Room not found.')
  }

  const room = roomSnap.data() as RoomDoc

  if (room.status !== 'lobby') {
    throw new Error('This game has already started.')
  }

  const playersSnap = await getDocs(collection(db, 'rooms', roomCode, 'players'))
  const alreadyJoined = playersSnap.docs.some(
    (player) => player.id === params.playerId,
  )

  if (!alreadyJoined && playersSnap.size >= MAX_PLAYERS) {
    throw new Error('This room is full.')
  }

  await setDoc(
    doc(db, 'rooms', roomCode, 'players', params.playerId),
    {
      name: playerName,
      ready: false,
      isHost: room.hostId === params.playerId,
      joinedAt: serverTimestamp(),
    },
    { merge: true },
  )

  return roomCode
}

export function listenToRoom(
  roomCode: string,
  callback: (room: RoomDoc | null) => void,
): Unsubscribe {
  return onSnapshot(doc(db, 'rooms', normalizeRoomCode(roomCode)), (snapshot) => {
    if (!snapshot.exists()) {
      callback(null)
      return
    }

    callback(snapshot.data() as RoomDoc)
  })
}

export function listenToPlayers(
  roomCode: string,
  callback: (players: LobbyPlayer[]) => void,
): Unsubscribe {
  return onSnapshot(
    collection(db, 'rooms', normalizeRoomCode(roomCode), 'players'),
    (snapshot) => {
      const players = snapshot.docs.map((playerDoc) => ({
        id: playerDoc.id,
        ...(playerDoc.data() as Omit<LobbyPlayer, 'id'>),
      }))

      callback(players)
    },
  )
}

export async function setPlayerReady(params: {
  roomCode: string
  playerId: string
  ready: boolean
}) {
  await updateDoc(
    doc(db, 'rooms', normalizeRoomCode(params.roomCode), 'players', params.playerId),
    {
      ready: params.ready,
    },
  )
}
EOF

cat > src/pages/HomePage.tsx <<'EOF'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '../components/ui/Button'
import { useAuth } from '../context/AuthContext'
import { createRoom, joinRoom } from '../firebase/rooms'
import { normalizeRoomCode } from '../utils/roomCode'

export function HomePage() {
  const navigate = useNavigate()
  const { user, loading } = useAuth()

  const [playerName, setPlayerName] = useState('')
  const [roomCode, setRoomCode] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function handleCreateRoom() {
    if (!user) return

    setError('')
    setBusy(true)

    try {
      const newRoomCode = await createRoom({
        hostId: user.uid,
        playerName,
      })

      navigate(`/lobby/${newRoomCode}`)
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Could not create room.')
    } finally {
      setBusy(false)
    }
  }

  async function handleJoinRoom() {
    if (!user) return

    setError('')
    setBusy(true)

    try {
      const joinedRoomCode = await joinRoom({
        roomCode,
        playerId: user.uid,
        playerName,
      })

      navigate(`/lobby/${joinedRoomCode}`)
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Could not join room.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="mx-auto flex min-h-screen w-full max-w-3xl flex-col justify-center px-4 py-10">
      <div className="rounded-3xl border border-slate-800 bg-slate-900/70 p-6 shadow-xl">
        <p className="mb-2 text-sm font-semibold uppercase tracking-[0.3em] text-cyan-300">
          Deduction Game
        </p>

        <h1 className="text-4xl font-black tracking-tight sm:text-6xl">
          Find your hidden identity.
        </h1>

        <p className="mt-4 max-w-xl text-slate-300">
          Create or join a no-account multiplayer deduction room.
        </p>

        <div className="mt-8 space-y-4">
          <label className="block">
            <span className="text-sm font-semibold text-slate-300">
              Player Name
            </span>
            <input
              value={playerName}
              onChange={(event) => setPlayerName(event.target.value)}
              className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-slate-100 outline-none focus:border-cyan-300"
              maxLength={20}
              placeholder="Example: Solaf"
            />
          </label>

          <div className="grid gap-3 sm:grid-cols-2">
            <Button
              onClick={handleCreateRoom}
              disabled={loading || busy || !playerName.trim()}
            >
              Create Game
            </Button>

            <div className="flex gap-2">
              <input
                value={roomCode}
                onChange={(event) =>
                  setRoomCode(normalizeRoomCode(event.target.value))
                }
                className="min-w-0 flex-1 rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-slate-100 uppercase outline-none focus:border-cyan-300"
                maxLength={4}
                placeholder="ABCD"
              />

              <Button
                variant="secondary"
                onClick={handleJoinRoom}
                disabled={
                  loading || busy || !playerName.trim() || roomCode.length < 4
                }
              >
                Join
              </Button>
            </div>
          </div>

          {error ? (
            <p className="rounded-xl border border-rose-500/50 bg-rose-950/40 px-4 py-3 text-sm text-rose-200">
              {error}
            </p>
          ) : null}
        </div>
      </div>
    </section>
  )
}
EOF

cat > src/pages/LobbyPage.tsx <<'EOF'
import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Button } from '../components/ui/Button'
import { useAuth } from '../context/AuthContext'
import {
  listenToPlayers,
  listenToRoom,
  setPlayerReady,
} from '../firebase/rooms'
import type { LobbyPlayer, RoomDoc } from '../types/room'

export function LobbyPage() {
  const { roomCode = '' } = useParams()
  const { user } = useAuth()

  const [room, setRoom] = useState<RoomDoc | null>(null)
  const [players, setPlayers] = useState<LobbyPlayer[]>([])
  const [error, setError] = useState('')

  useEffect(() => {
    if (!roomCode) return

    const unsubscribeRoom = listenToRoom(roomCode, setRoom)
    const unsubscribePlayers = listenToPlayers(roomCode, setPlayers)

    return () => {
      unsubscribeRoom()
      unsubscribePlayers()
    }
  }, [roomCode])

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

        <Link to="/">
          <Button variant="secondary">Leave</Button>
        </Link>
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

        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
          <h2 className="font-bold">Room Controls</h2>

          <div className="mt-4 space-y-3">
            <Button
              variant={currentPlayer?.ready ? 'secondary' : 'primary'}
              onClick={handleToggleReady}
              disabled={!currentPlayer}
              className="w-full"
            >
              {currentPlayer?.ready ? 'Unready' : 'Ready Up'}
            </Button>

            <Button disabled={!canStart} className="w-full">
              Start Game
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
    </section>
  )
}
EOF

npm run check
