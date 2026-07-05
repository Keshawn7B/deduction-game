import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '../components/ui/Button'
import { useAuth } from '../context/AuthContext'
import { createRoom, joinRoom } from '../firebase/rooms'
import { normalizeRoomCode } from '../utils/roomCode'

export function HomePage() {
  const navigate = useNavigate()
  const { user, loading, error: authError } = useAuth()

  const [playerName, setPlayerName] = useState('')
  const [roomCode, setRoomCode] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function handleCreateRoom() {
    setError('')

    if (!user) {
      setError(
        'Not signed in yet. Enable Firebase Anonymous Authentication, then refresh.',
      )
      return
    }

    setBusy(true)

    try {
      const newRoomCode = await createRoom({
        hostId: user.uid,
        playerName,
      })

      navigate(`/lobby/${newRoomCode}`)
    } catch (error) {
      console.error('Create room failed:', error)
      setError(error instanceof Error ? error.message : 'Could not create room.')
    } finally {
      setBusy(false)
    }
  }

  async function handleJoinRoom() {
    setError('')

    if (!user) {
      setError(
        'Not signed in yet. Enable Firebase Anonymous Authentication, then refresh.',
      )
      return
    }

    setBusy(true)

    try {
      const joinedRoomCode = await joinRoom({
        roomCode,
        playerId: user.uid,
        playerName,
      })

      navigate(`/lobby/${joinedRoomCode}`)
    } catch (error) {
      console.error('Join room failed:', error)
      setError(error instanceof Error ? error.message : 'Could not join room.')
    } finally {
      setBusy(false)
    }
  }

  const visibleError = error || authError

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

        <div className="mt-4 rounded-xl bg-slate-950 px-4 py-3 text-sm text-slate-300">
          Auth status:{' '}
          {loading ? 'Loading...' : user ? 'Signed in anonymously' : 'Not signed in'}
        </div>

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

          {visibleError ? (
            <p className="rounded-xl border border-rose-500/50 bg-rose-950/40 px-4 py-3 text-sm text-rose-200">
              {visibleError}
            </p>
          ) : null}
        </div>
      </div>
    </section>
  )
}
