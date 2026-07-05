#!/usr/bin/env zsh
set -e

cd ~/deduction-game

python3 - <<'PY'
from pathlib import Path

path = Path("src/pages/LobbyPage.tsx")
text = path.read_text()

# Add wasJoined state.
if "const [wasJoined, setWasJoined] = useState(false)" not in text:
    text = text.replace(
        "  const [removingPlayerId, setRemovingPlayerId] = useState('')\n",
        "  const [removingPlayerId, setRemovingPlayerId] = useState('')\n  const [wasJoined, setWasJoined] = useState(false)\n",
    )

# Replace initial joinName state with localStorage prefill.
text = text.replace(
    "  const [joinName, setJoinName] = useState('')\n",
    "  const [joinName, setJoinName] = useState(() =>\n    window.localStorage.getItem('deducktionPlayerName') ?? '',\n  )\n",
)

# Insert removed-player detection after currentPlayer memo.
marker = """  const isHost = room?.hostId === user?.uid
"""
insert = """  useEffect(() => {
    if (currentPlayer) {
      setWasJoined(true)
      return
    }

    if (wasJoined && room?.status === 'lobby') {
      navigate('/')
    }
  }, [currentPlayer, navigate, room?.status, wasJoined])

"""
if insert.strip() not in text:
    if marker not in text:
        raise SystemExit("Could not find isHost marker.")
    text = text.replace(marker, insert + marker)

# Make localStorage save use trimmed value.
text = text.replace(
    "      window.localStorage.setItem('deducktionPlayerName', joinName.trim())",
    "      window.localStorage.setItem('deducktionPlayerName', joinName.trim())",
)

path.write_text(text)
PY

npm run check

echo ""
echo "Lobby removal/direct-link polish complete."
echo "Run: npm run dev"
