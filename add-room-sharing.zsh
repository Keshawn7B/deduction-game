#!/usr/bin/env zsh
set -e

cd ~/deduction-game

mkdir -p src/components/room

cat > src/components/room/RoomShareBox.tsx <<'EOF'
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
EOF

python3 - <<'PY'
from pathlib import Path

path = Path("src/pages/LobbyPage.tsx")
text = path.read_text()

if "RoomShareBox" not in text:
    text = text.replace(
        "import { Button } from '../components/ui/Button'\n",
        "import { RoomShareBox } from '../components/room/RoomShareBox'\nimport { Button } from '../components/ui/Button'\n",
    )

old = """        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
          <h2 className="font-bold">Room Controls</h2>"""

new = """        <div className="space-y-4">
          <RoomShareBox roomCode={roomCode} />

          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
            <h2 className="font-bold">Room Controls</h2>"""

if old in text:
    text = text.replace(old, new, 1)

old_end = """          </div>
        </div>
      </div>
    </section>"""

new_end = """          </div>
        </div>
        </div>
      </div>
    </section>"""

# Only add the extra closing div if RoomShareBox wrapper was just added and the file does not already have it.
if "RoomShareBox roomCode={roomCode}" in text and "        </div>\n        </div>\n      </div>" not in text:
    text = text.replace(old_end, new_end, 1)

path.write_text(text)
PY

python3 - <<'PY'
from pathlib import Path

path = Path("src/pages/GamePage.tsx")
text = path.read_text()

if "RoomShareBox" not in text:
    text = text.replace(
        "import { CardView } from '../components/game/CardView'\n",
        "import { CardView } from '../components/game/CardView'\nimport { RoomShareBox } from '../components/room/RoomShareBox'\n",
    )

old = """        <div className="space-y-4">
          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
            <h2 className="font-bold">Players</h2>"""

new = """        <div className="space-y-4">
          <RoomShareBox roomCode={roomCode} />

          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
            <h2 className="font-bold">Players</h2>"""

if old in text and "RoomShareBox roomCode={roomCode}" not in text.split("Game Log")[0]:
    text = text.replace(old, new, 1)

path.write_text(text)
PY

npm run check

echo ""
echo "Room sharing patch complete."
echo "Run: npm run dev"
