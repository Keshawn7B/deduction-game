import { useMemo, useState } from 'react'
import { Button } from '../ui/Button'

type RoomShareBoxProps = {
  roomCode: string
}

export function RoomShareBox({ roomCode }: RoomShareBoxProps) {
  const [status, setStatus] = useState('')

  const roomLink = useMemo(() => {
    if (typeof window === 'undefined') {
      return `#/lobby/${roomCode}`
    }

    return `${window.location.origin}${window.location.pathname}#/lobby/${roomCode}`
  }, [roomCode])

  async function copyText(value: string, successMessage: string) {
    try {
      await navigator.clipboard.writeText(value)
      setStatus(successMessage)
    } catch {
      setStatus('Copy failed. Select and copy it manually.')
    }
  }

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
      <h2 className="font-bold">Invite Players</h2>

      <div className="mt-4 space-y-3">
        <div className="rounded-xl bg-slate-950 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
            Room Code
          </p>
          <p className="mt-1 font-mono text-2xl font-black text-cyan-300">
            {roomCode}
          </p>
        </div>

        <div className="rounded-xl bg-slate-950 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
            Room Link
          </p>
          <p className="mt-1 break-all font-mono text-sm text-slate-300">
            {roomLink}
          </p>
        </div>

        <div className="grid gap-2 sm:grid-cols-2">
          <Button
            variant="secondary"
            onClick={() => copyText(roomCode, 'Room code copied.')}
          >
            Copy Code
          </Button>

          <Button
            variant="secondary"
            onClick={() => copyText(roomLink, 'Room link copied.')}
          >
            Copy Link
          </Button>
        </div>

        {status ? <p className="text-sm text-slate-300">{status}</p> : null}
      </div>
    </div>
  )
}
