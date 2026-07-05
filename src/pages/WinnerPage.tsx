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
