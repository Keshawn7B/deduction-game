import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '../components/ui/Button'
import { useAuth } from '../context/AuthContext'
import { createRoom, joinRoom } from '../firebase/rooms'
import { normalizeRoomCode } from '../utils/roomCode'

const titleBackgroundUrl = `${import.meta.env.BASE_URL}assets/title/deduction-hero-bg.png`

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
    <section className="relative min-h-screen overflow-hidden px-4 py-6 sm:px-6 lg:px-8">
      <div
        className="absolute inset-0 bg-cover bg-center opacity-95"
        style={{ backgroundImage: `url(${titleBackgroundUrl})` }}
        aria-hidden="true"
      />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_38%,rgba(34,211,238,0.18),transparent_34%),radial-gradient(circle_at_50%_78%,rgba(251,191,36,0.13),transparent_26%),linear-gradient(180deg,rgba(2,6,23,0.78)_0%,rgba(2,6,23,0.58)_42%,rgba(2,6,23,0.94)_100%)]" />
      <div className="absolute inset-x-0 bottom-0 h-64 bg-gradient-to-t from-slate-950 via-slate-950/75 to-transparent" />

      <div className="relative mx-auto flex min-h-[calc(100vh-3rem)] w-full max-w-6xl flex-col items-center justify-center gap-8 pb-24 pt-12 text-center">
        <div className="max-w-5xl">
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-cyan-200/25 bg-cyan-200/10 px-4 py-2 text-xs font-black uppercase tracking-[0.28em] text-cyan-100 shadow-lg shadow-cyan-950/40 backdrop-blur">
            <span className="h-2 w-2 rounded-full bg-cyan-300 shadow-[0_0_18px_rgba(103,232,249,0.95)]" />
            Multiplayer mystery
          </div>

          <h1 className="text-7xl font-black leading-none tracking-[-0.08em] text-white drop-shadow-2xl sm:text-8xl lg:text-9xl">
            Flocked
          </h1>

          <p className="mx-auto mt-5 max-w-3xl text-lg leading-8 text-slate-100 drop-shadow sm:text-2xl">
            A cozy deduction game where every player hides in plain sight.
          </p>
        </div>

        <div className="w-full max-w-2xl rounded-[2rem] border border-white/15 bg-slate-950/78 p-4 shadow-2xl shadow-slate-950/75 backdrop-blur-xl sm:p-6">
          <div className="rounded-[1.5rem] border border-cyan-200/20 bg-gradient-to-br from-slate-900/92 to-slate-950/95 p-5 shadow-inner shadow-cyan-950/40 sm:p-7">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.24em] text-cyan-200">
                Play now
              </p>
              <h2 className="mt-2 text-2xl font-black text-white sm:text-3xl">
                Join the flock
              </h2>
            </div>

            <div className="mt-6 space-y-4 text-left">
              <label className="block">
                <span className="text-sm font-semibold text-slate-200">
                  Player Name
                </span>
                <input
                  value={playerName}
                  onChange={(event) => setPlayerName(event.target.value)}
                  className="mt-2 w-full rounded-2xl border border-slate-700 bg-slate-950/90 px-4 py-3 text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-cyan-300 focus:ring-4 focus:ring-cyan-300/10"
                  maxLength={20}
                  placeholder="Example: Solaf"
                />
              </label>

              <div className="rounded-3xl border border-cyan-200/15 bg-cyan-200/5 p-4 shadow-lg shadow-cyan-950/20">
                <label className="block">
                  <span className="block text-center text-sm font-bold text-slate-100">
                    Enter a room code
                  </span>
                  <div className="mt-3 flex flex-col gap-3 sm:flex-row">
                    <input
                      value={roomCode}
                      onChange={(event) =>
                        setRoomCode(normalizeRoomCode(event.target.value))
                      }
                      className="min-w-0 flex-1 rounded-2xl border border-slate-700 bg-slate-950 px-4 py-4 text-center text-2xl font-black uppercase tracking-[0.4em] text-slate-100 outline-none transition placeholder:tracking-normal placeholder:text-slate-600 focus:border-cyan-300 focus:ring-4 focus:ring-cyan-300/10"
                      maxLength={4}
                      placeholder="ABCD"
                    />

                    <Button
                      variant="secondary"
                      onClick={handleJoinRoom}
                      disabled={
                        loading ||
                        busy ||
                        !playerName.trim() ||
                        roomCode.length < 4
                      }
                      className="justify-center px-8 py-4 text-base"
                    >
                      Join Room
                    </Button>
                  </div>
                </label>
              </div>

              <div className="flex items-center gap-3">
                <div className="h-px flex-1 bg-slate-800" />
                <span className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">
                  or
                </span>
                <div className="h-px flex-1 bg-slate-800" />
              </div>

              <Button
                onClick={handleCreateRoom}
                disabled={loading || busy || !playerName.trim()}
                className="w-full justify-center py-4 text-base shadow-lg shadow-cyan-950/40"
              >
                Create New Game
              </Button>

              {visibleError ? (
                <p className="rounded-2xl border border-rose-500/50 bg-rose-950/50 px-4 py-3 text-sm text-rose-100">
                  {visibleError}
                </p>
              ) : null}
            </div>
          </div>
        </div>

        <div className="flex max-w-3xl flex-wrap justify-center gap-3 text-sm font-semibold text-slate-200">
          <span className="rounded-full border border-white/15 bg-white/10 px-4 py-2 backdrop-blur">
            8 animals
          </span>
          <span className="rounded-full border border-white/15 bg-white/10 px-4 py-2 backdrop-blur">
            8 backgrounds
          </span>
          <span className="rounded-full border border-white/15 bg-white/10 px-4 py-2 backdrop-blur">
            8 accessories
          </span>
          <span className="rounded-full border border-amber-200/25 bg-amber-200/10 px-4 py-2 text-amber-100 backdrop-blur">
            No account needed
          </span>
        </div>
      </div>
    </section>
  )
}
