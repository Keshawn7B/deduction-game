#!/usr/bin/env zsh
set -e

cd ~/deduction-game

python3 - <<'PY'
from pathlib import Path

path = Path("src/firebase/rooms.ts")
text = path.read_text()

if "export async function leaveGame(" not in text:
    marker = "export function listenToRoom("
    leave_function = r"""export async function leaveGame(params: {
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
  const players = await getLobbyPlayers(roomCode)
  const leavingPlayer = players.find((player) => player.id === params.playerId)
  const playerName = leavingPlayer?.name ?? 'A player'
  const remainingPlayers = players.filter((player) => player.id !== params.playerId)

  const batch = writeBatch(db)

  if (room.status === 'lobby') {
    batch.delete(doc(db, 'rooms', roomCode, 'players', params.playerId))

    if (remainingPlayers.length === 0) {
      batch.update(roomRef, {
        status: 'finished',
        currentTurnPlayerId: null,
        winnerId: null,
      })
    } else if (room.hostId === params.playerId) {
      const nextHost = remainingPlayers[0]

      batch.update(roomRef, {
        hostId: nextHost.id,
      })

      batch.update(doc(db, 'rooms', roomCode, 'players', nextHost.id), {
        isHost: true,
      })
    }

    batch.set(doc(collection(db, 'rooms', roomCode, 'log')), {
      message: `${playerName} left the lobby.`,
      createdAt: serverTimestamp(),
    })

    await batch.commit()

    return {
      gameFinished: remainingPlayers.length === 0,
      winnerId: null,
    }
  }

  if (room.status !== 'playing') {
    return {
      gameFinished: room.status === 'finished',
      winnerId: room.winnerId,
    }
  }

  const states = await getPlayerStates(roomCode)
  const currentState = states.find((state) => state.playerId === params.playerId)

  if (!currentState) {
    throw new Error('Player state not found.')
  }

  const nextPlayerState: PlayerGameState = {
    ...currentState,
    hand: [],
    hideYesPile: true,
    hideNoPile: true,
    eliminated: true,
  }

  const stateByPlayerId = new Map(states.map((state) => [state.playerId, state]))
  stateByPlayerId.set(params.playerId, nextPlayerState)

  const activePlayersAfterLeave = players.filter((player) => {
    const state = stateByPlayerId.get(player.id)
    return !state?.eliminated
  })

  batch.set(
    doc(db, 'rooms', roomCode, 'playerStates', params.playerId),
    nextPlayerState,
  )

  if (room.hostId === params.playerId && remainingPlayers.length > 0) {
    const nextHost = remainingPlayers[0]

    batch.update(roomRef, {
      hostId: nextHost.id,
    })

    batch.update(doc(db, 'rooms', roomCode, 'players', nextHost.id), {
      isHost: true,
    })
  }

  if (activePlayersAfterLeave.length === 1) {
    const winner = activePlayersAfterLeave[0]
    const winnerName = winner?.name ?? 'The remaining player'

    batch.update(roomRef, {
      status: 'finished',
      winnerId: winner?.id ?? null,
      currentTurnPlayerId: null,
    })

    batch.set(doc(collection(db, 'rooms', roomCode, 'log')), {
      message: `${playerName} left the game. ${winnerName} wins as the last remaining player.`,
      createdAt: serverTimestamp(),
    })

    await batch.commit()

    return {
      gameFinished: true,
      winnerId: winner?.id ?? null,
    }
  }

  if (activePlayersAfterLeave.length === 0) {
    batch.update(roomRef, {
      status: 'finished',
      winnerId: null,
      currentTurnPlayerId: null,
    })

    batch.set(doc(collection(db, 'rooms', roomCode, 'log')), {
      message: `${playerName} left the game. No active players remain.`,
      createdAt: serverTimestamp(),
    })

    await batch.commit()

    return {
      gameFinished: true,
      winnerId: null,
    }
  }

  if (room.currentTurnPlayerId === params.playerId) {
    const nextTurnPlayerId = getNextActiveTurnPlayerId({
      players,
      states,
      currentPlayerId: params.playerId,
      currentPlayerNextState: nextPlayerState,
    })

    batch.update(roomRef, {
      currentTurnPlayerId: nextTurnPlayerId,
    })
  }

  batch.set(doc(collection(db, 'rooms', roomCode, 'log')), {
    message: `${playerName} left the game.`,
    createdAt: serverTimestamp(),
  })

  await batch.commit()

  return {
    gameFinished: false,
    winnerId: null,
  }
}

"""
    if marker not in text:
        raise SystemExit("Could not find listenToRoom marker in src/firebase/rooms.ts")
    text = text.replace(marker, leave_function + marker)
    path.write_text(text)
PY

python3 - <<'PY'
from pathlib import Path

path = Path("src/pages/GamePage.tsx")
text = path.read_text()

if "  leaveGame," not in text:
    text = text.replace(
        "  listenToRoom,\n  revealCard,\n",
        "  listenToRoom,\n  revealCard,\n  leaveGame,\n",
    )

if "const [leaving, setLeaving] = useState(false)" not in text:
    text = text.replace(
        "  const [busy, setBusy] = useState(false)\n",
        "  const [busy, setBusy] = useState(false)\n  const [leaving, setLeaving] = useState(false)\n",
    )

if "async function handleLeaveGame()" not in text:
    marker = "  return (\n"
    handler = r"""  async function handleLeaveGame() {
    if (!user) return

    const confirmed = window.confirm(
      'Leave this game? You will be removed from active play.',
    )

    if (!confirmed) return

    setLeaving(true)
    setError('')

    try {
      await leaveGame({
        roomCode,
        playerId: user.uid,
      })

      navigate('/')
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Could not leave game.')
    } finally {
      setLeaving(false)
    }
  }

"""
    if marker not in text:
        raise SystemExit("Could not find return marker in src/pages/GamePage.tsx")
    text = text.replace(marker, handler + marker, 1)

old = """        <Link to={`/game/${roomCode}/guess`}>
          <Button disabled={isEliminated}>Make Guess</Button>
        </Link>"""

new = """        <div className="flex gap-2">
          <Button variant="danger" onClick={handleLeaveGame} disabled={leaving}>
            {leaving ? 'Leaving...' : 'Leave Game'}
          </Button>

          <Link to={`/game/${roomCode}/guess`}>
            <Button disabled={isEliminated}>Make Guess</Button>
          </Link>
        </div>"""

if old in text:
    text = text.replace(old, new)
elif "Leave Game" not in text:
    raise SystemExit("Could not find GamePage guess button block to replace.")

path.write_text(text)
PY

python3 - <<'PY'
from pathlib import Path

path = Path("src/pages/LobbyPage.tsx")
text = path.read_text()

text = text.replace(
    "import { Link, useNavigate, useParams } from 'react-router-dom'",
    "import { useNavigate, useParams } from 'react-router-dom'",
)

if "  leaveGame," not in text:
    text = text.replace(
        "  startGame,\n",
        "  startGame,\n  leaveGame,\n",
    )

if "const [leaving, setLeaving] = useState(false)" not in text:
    text = text.replace(
        "  const [busy, setBusy] = useState(false)\n",
        "  const [busy, setBusy] = useState(false)\n  const [leaving, setLeaving] = useState(false)\n",
    )

if "async function handleLeaveRoom()" not in text:
    marker = "  return (\n"
    handler = r"""  async function handleLeaveRoom() {
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

"""
    if marker not in text:
        raise SystemExit("Could not find return marker in src/pages/LobbyPage.tsx")
    text = text.replace(marker, handler + marker, 1)

old = """        <Link to="/">
          <Button variant="secondary">Leave</Button>
        </Link>"""

new = """        <Button variant="secondary" onClick={handleLeaveRoom} disabled={leaving}>
          {leaving ? 'Leaving...' : 'Leave Room'}
        </Button>"""

if old in text:
    text = text.replace(old, new)
elif "Leave Room" not in text:
    raise SystemExit("Could not find LobbyPage Leave link block to replace.")

text = text.replace(
    "disabled={!currentPlayer || busy}",
    "disabled={!currentPlayer || busy || leaving}",
)

text = text.replace(
    "disabled={!canStart || busy}",
    "disabled={!canStart || busy || leaving}",
)

path.write_text(text)
PY

npm run check

echo ""
echo "Leave game patch complete."
echo "Run: npm run dev"
