#!/usr/bin/env zsh
set -e

cd ~/deduction-game

mkdir -p src/types src/components/game src/firebase src/pages

cat > src/types/game.ts <<'EOF'
import type { Card } from './card'

export type PlayerGameState = {
  playerId: string
  hand: Card[]
  yesPile: Card[]
  noPile: Card[]
  hideYesPile: boolean
  hideNoPile: boolean
  wrongGuesses: number
  eliminated: boolean
}

export type PlayerIdentityDoc = {
  playerId: string
  hiddenIdentity: Card
}

export type PrivateDeckDoc = {
  deck: Card[]
  discardPile: Card[]
}
EOF

cat > src/components/game/CardView.tsx <<'EOF'
import type { Card } from '../../types/card'

type CardViewProps = {
  card: Card
  label?: string
}

export function CardView({ card, label }: CardViewProps) {
  return (
    <div className="rounded-2xl border border-slate-700 bg-slate-950 p-4 shadow">
      {label ? (
        <p className="mb-2 text-xs font-bold uppercase tracking-[0.2em] text-cyan-300">
          {label}
        </p>
      ) : null}

      <div className="space-y-1">
        <p className="text-lg font-black text-slate-100">{card.animal}</p>
        <p className="text-sm text-slate-300">{card.disguise}</p>
        <p className="text-sm text-slate-400">{card.location}</p>
      </div>
    </div>
  )
}
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
  writeBatch,
  type Unsubscribe,
} from 'firebase/firestore'
import { createInitialGameState } from '../game/setup'
import type { PlayerGameState, PlayerIdentityDoc } from '../types/game'
import type { LobbyPlayer, RoomDoc } from '../types/room'
import { createRoomCode, normalizeRoomCode } from '../utils/roomCode'
import { db } from './client'

const MAX_PLAYERS = 4

function getPlayerSortValue(player: LobbyPlayer): number {
  const joinedAt = player.joinedAt as { seconds?: number } | null

  if (joinedAt?.seconds) {
    return joinedAt.seconds
  }

  return 0
}

function sortPlayers(players: LobbyPlayer[]): LobbyPlayer[] {
  return [...players].sort((a, b) => {
    const joinedDiff = getPlayerSortValue(a) - getPlayerSortValue(b)

    if (joinedDiff !== 0) {
      return joinedDiff
    }

    return a.name.localeCompare(b.name)
  })
}

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

export async function startGame(params: {
  roomCode: string
  hostId: string
}) {
  const roomCode = normalizeRoomCode(params.roomCode)
  const roomRef = doc(db, 'rooms', roomCode)
  const roomSnap = await getDoc(roomRef)

  if (!roomSnap.exists()) {
    throw new Error('Room not found.')
  }

  const room = roomSnap.data() as RoomDoc

  if (room.hostId !== params.hostId) {
    throw new Error('Only the host can start the game.')
  }

  if (room.status !== 'lobby') {
    throw new Error('This game has already started.')
  }

  const playersSnap = await getDocs(collection(db, 'rooms', roomCode, 'players'))

  const players = sortPlayers(
    playersSnap.docs.map((playerDoc) => ({
      id: playerDoc.id,
      ...(playerDoc.data() as Omit<LobbyPlayer, 'id'>),
    })),
  )

  if (players.length < 2 || players.length > 4) {
    throw new Error('Game requires 2–4 players.')
  }

  if (!players.every((player) => player.ready)) {
    throw new Error('Every player must be ready.')
  }

  const initialGameState = createInitialGameState(
    players.map((player) => player.id),
  )

  const batch = writeBatch(db)

  for (const playerState of initialGameState.players) {
    const state: PlayerGameState = {
      playerId: playerState.playerId,
      hand: playerState.hand,
      yesPile: playerState.yesPile,
      noPile: playerState.noPile,
      hideYesPile: false,
      hideNoPile: false,
      wrongGuesses: playerState.wrongGuesses,
      eliminated: playerState.eliminated,
    }

    const identity: PlayerIdentityDoc = {
      playerId: playerState.playerId,
      hiddenIdentity: playerState.hiddenIdentity,
    }

    batch.set(
      doc(db, 'rooms', roomCode, 'playerStates', playerState.playerId),
      state,
    )

    batch.set(
      doc(db, 'rooms', roomCode, 'identities', playerState.playerId),
      identity,
    )
  }

  batch.set(doc(db, 'rooms', roomCode, 'privateDeck', 'state'), {
    deck: initialGameState.deck,
    discardPile: initialGameState.discardPile,
  })

  batch.set(doc(collection(db, 'rooms', roomCode, 'log')), {
    message: 'Game started. Cards were dealt.',
    createdAt: serverTimestamp(),
  })

  batch.update(roomRef, {
    status: 'playing',
    currentTurnPlayerId: initialGameState.currentTurnPlayerId,
  })

  await batch.commit()
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
      const players = sortPlayers(
        snapshot.docs.map((playerDoc) => ({
          id: playerDoc.id,
          ...(playerDoc.data() as Omit<LobbyPlayer, 'id'>),
        })),
      )

      callback(players)
    },
  )
}

export function listenToPlayerState(
  roomCode: string,
  playerId: string,
  callback: (state: PlayerGameState | null) => void,
): Unsubscribe {
  return onSnapshot(
    doc(db, 'rooms', normalizeRoomCode(roomCode), 'playerStates', playerId),
    (snapshot) => {
      if (!snapshot.exists()) {
        callback(null)
        return
      }

      callback(snapshot.data() as PlayerGameState)
    },
  )
}

export function listenToIdentities(
  roomCode: string,
  callback: (identities: PlayerIdentityDoc[]) => void,
): Unsubscribe {
  return onSnapshot(
    collection(db, 'rooms', normalizeRoomCode(roomCode), 'identities'),
    (snapshot) => {
      const identities = snapshot.docs.map(
        (identityDoc) => identityDoc.data() as PlayerIdentityDoc,
      )

      callback(identities)
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

cat > src/pages/LobbyPage.tsx <<'EOF'
import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Button } from '../components/ui/Button'
import { useAuth } from '../context/AuthContext'
import {
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
              disabled={!currentPlayer || busy}
              className="w-full"
            >
              {currentPlayer?.ready ? 'Unready' : 'Ready Up'}
            </Button>

            <Button
              disabled={!canStart || busy}
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
    </section>
  )
}
EOF

cat > src/pages/GamePage.tsx <<'EOF'
import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { CardView } from '../components/game/CardView'
import { Button } from '../components/ui/Button'
import { useAuth } from '../context/AuthContext'
import {
  listenToIdentities,
  listenToPlayers,
  listenToPlayerState,
  listenToRoom,
} from '../firebase/rooms'
import type { PlayerGameState, PlayerIdentityDoc } from '../types/game'
import type { LobbyPlayer, RoomDoc } from '../types/room'

export function GamePage() {
  const { roomCode = '' } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()

  const [room, setRoom] = useState<RoomDoc | null>(null)
  const [players, setPlayers] = useState<LobbyPlayer[]>([])
  const [playerState, setPlayerState] = useState<PlayerGameState | null>(null)
  const [identities, setIdentities] = useState<PlayerIdentityDoc[]>([])

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

    return () => {
      unsubscribeRoom()
      unsubscribePlayers()
      unsubscribePlayerState()
      unsubscribeIdentities()
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

  return (
    <section className="mx-auto min-h-screen max-w-6xl px-4 py-8">
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

        <Link to={`/game/${roomCode}/guess`}>
          <Button>Make Guess</Button>
        </Link>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-[2fr_1fr]">
        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
          <h2 className="font-bold">Your Hand</h2>

          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {playerState?.hand.map((card) => (
              <CardView key={card.id} card={card} />
            ))}

            {!playerState ? (
              <p className="text-sm text-slate-400">Loading your cards...</p>
            ) : null}
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
            <h2 className="font-bold">Your Clues</h2>

            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-slate-950 p-4">
                <p className="text-sm text-slate-400">YES pile</p>
                <p className="text-3xl font-black text-emerald-300">
                  {playerState?.yesPile.length ?? 0}
                </p>
              </div>

              <div className="rounded-xl bg-slate-950 p-4">
                <p className="text-sm text-slate-400">NO pile</p>
                <p className="text-3xl font-black text-rose-300">
                  {playerState?.noPile.length ?? 0}
                </p>
              </div>
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
      </div>
    </section>
  )
}
EOF

npm run check

echo ""
echo "Start-game patch complete."
echo "Run: npm run dev"
