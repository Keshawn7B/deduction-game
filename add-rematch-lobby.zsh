#!/usr/bin/env zsh
set -e

cd ~/deduction-game

python3 - <<'PY'
from pathlib import Path

path = Path("src/firebase/rooms.ts")
text = path.read_text()

if "export async function resetRoomForRematch(" not in text:
    marker = "export async function leaveGame("
    rematch_function = r"""export async function resetRoomForRematch(params: {
  roomCode: string
  playerId: string
}) {
  const roomCode = normalizeRoomCode(params.roomCode)
  const roomRef = doc(db, 'rooms', roomCode)
  const roomSnap = await getDoc(roomRef)

  if (!roomSnap.exists()) {
    throw new Error('Room not found.')
  }

  const room = roomSnap.data() as RoomDoc

  if (room.hostId !== params.playerId) {
    throw new Error('Only the host can start a rematch lobby.')
  }

  if (room.status !== 'finished') {
    throw new Error('This game is not finished yet.')
  }

  const players = await getLobbyPlayers(roomCode)

  const [statesSnap, identitiesSnap, deckSnap, logSnap] = await Promise.all([
    getDocs(collection(db, 'rooms', roomCode, 'playerStates')),
    getDocs(collection(db, 'rooms', roomCode, 'identities')),
    getDocs(collection(db, 'rooms', roomCode, 'privateDeck')),
    getDocs(collection(db, 'rooms', roomCode, 'log')),
  ])

  const batch = writeBatch(db)

  for (const stateDoc of statesSnap.docs) {
    batch.delete(stateDoc.ref)
  }

  for (const identityDoc of identitiesSnap.docs) {
    batch.delete(identityDoc.ref)
  }

  for (const deckDoc of deckSnap.docs) {
    batch.delete(deckDoc.ref)
  }

  for (const logDoc of logSnap.docs) {
    batch.delete(logDoc.ref)
  }

  for (const player of players) {
    batch.update(doc(db, 'rooms', roomCode, 'players', player.id), {
      ready: player.id === room.hostId,
      isHost: player.id === room.hostId,
    })
  }

  batch.update(roomRef, {
    status: 'lobby',
    currentTurnPlayerId: null,
    winnerId: null,
  })

  await batch.commit()
}

"""
    if marker not in text:
        raise SystemExit("Could not find leaveGame marker in src/firebase/rooms.ts")
    text = text.replace(marker, rematch_function + marker)
    path.write_text(text)
PY

cat > src/pages/WinnerPage.tsx <<'EOF'
import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { CardView } from '../components/game/CardView'
import { Button } from '../components/ui/Button'
import { useAuth } from '../context/AuthContext'
import {
  listenToIdentities,
  listenToPlayers,
  listenToRoom,
  resetRoomForRematch,
} from '../firebase/rooms'
import type { PlayerIdentityDoc } from '../types/game'
import type { LobbyPlayer, RoomDoc } from '../types/room'

export function WinnerPage() {
  const { roomCode = '' } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()

  const [room, setRoom] = useState<RoomDoc | null>(null)
  const [players, setPlayers] = useState<LobbyPlayer[]>([])
  const [identities, setIdentities] = useState<PlayerIdentityDoc[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!roomCode) return

    const unsubscribeRoom = listenToRoom(roomCode, setRoom)
    const unsubscribePlayers = listenToPlayers(roomCode, setPlayers)
    const unsubscribeIdentities = listenToIdentities(roomCode, setIdentities)

    return () => {
      unsubscribeRoom()
      unsubscribePlayers()
      unsubscribeIdentities()
    }
  }, [roomCode])

  useEffect(() => {
    if (room?.status === 'lobby') {
      navigate(`/lobby/${roomCode}`)
    }
  }, [navigate, room?.status, roomCode])

  const playerNameById = useMemo(() => {
    return new Map(players.map((player) => [player.id, player.name]))
  }, [players])

  const winnerName = room?.winnerId
    ? playerNameById.get(room.winnerId) ?? 'Winner'
    : 'No winner'

  const isHost = room?.hostId === user?.uid

  async function handleRematch() {
    if (!user) return

    setBusy(true)
    setError('')

    try {
      await resetRoomForRematch({
        roomCode,
        playerId: user.uid,
      })

      navigate(`/lobby/${roomCode}`)
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Could not reset room.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="mx-auto flex min-h-screen max-w-4xl flex-col justify-center px-4 py-10">
      <div className="rounded-3xl border border-slate-800 bg-slate-900 p-6">
        <p className="text-sm font-semibold uppercase tracking-[0.3em] text-cyan-300">
          Room {roomCode}
        </p>

        <h1 className="mt-3 text-4xl font-black">{winnerName} wins</h1>

        <p className="mt-3 text-slate-300">
          Hidden identities are now revealed.
        </p>

        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          {identities.map((identity) => (
            <CardView
              key={identity.playerId}
              card={identity.hiddenIdentity}
              label={playerNameById.get(identity.playerId) ?? 'Player'}
            />
          ))}
        </div>

        {error ? (
          <p className="mt-5 rounded-xl border border-rose-500/50 bg-rose-950/40 px-4 py-3 text-sm text-rose-200">
            {error}
          </p>
        ) : null}

        <div className="mt-6 flex flex-wrap gap-3">
          {isHost ? (
            <Button onClick={handleRematch} disabled={busy}>
              {busy ? 'Resetting...' : 'Rematch Lobby'}
            </Button>
          ) : (
            <p className="rounded-xl bg-slate-950 px-4 py-3 text-sm text-slate-300">
              Waiting for the host to start a rematch lobby.
            </p>
          )}

          <Link to="/">
            <Button variant="secondary">Return Home</Button>
          </Link>
        </div>
      </div>
    </section>
  )
}
EOF

npm run check

echo ""
echo "Rematch lobby patch complete."
echo "Run: npm run dev"
