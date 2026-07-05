#!/usr/bin/env zsh
set -e

cd ~/deduction-game

python3 - <<'PY'
from pathlib import Path

rooms_path = Path("src/firebase/rooms.ts")
text = rooms_path.read_text()

old = """  const penalty = applyWrongGuessPenalty(playerState.wrongGuesses)

  const nextPlayerState: PlayerGameState = {
    ...playerState,
    wrongGuesses: penalty.wrongGuesses,
    hideYesPile: penalty.hideYesPile,
    hideNoPile: penalty.hideNoPile,
    eliminated: penalty.eliminated,
  }

  const nextTurnPlayerId = getNextActiveTurnPlayerId({
    players,
    states,
    currentPlayerId: params.playerId,
    currentPlayerNextState: nextPlayerState,
  })

  batch.set(playerStateRef, nextPlayerState)
  batch.update(roomRef, {
    currentTurnPlayerId: nextTurnPlayerId,
  })
  batch.set(doc(collection(db, 'rooms', roomCode, 'log')), {
    message: `${playerName} guessed incorrectly. Wrong guesses: ${penalty.wrongGuesses}.`,
    createdAt: serverTimestamp(),
  })

  await batch.commit()

  return {
    correct: false,
    eliminated: penalty.eliminated,
    wrongGuesses: penalty.wrongGuesses,
  }
"""

new = """  const penalty = applyWrongGuessPenalty(playerState.wrongGuesses)

  const nextPlayerState: PlayerGameState = {
    ...playerState,
    wrongGuesses: penalty.wrongGuesses,
    hideYesPile: penalty.hideYesPile,
    hideNoPile: penalty.hideNoPile,
    eliminated: penalty.eliminated,
  }

  const stateByPlayerId = new Map(states.map((state) => [state.playerId, state]))
  stateByPlayerId.set(params.playerId, nextPlayerState)

  const activePlayersAfterGuess = players.filter((player) => {
    const state = stateByPlayerId.get(player.id)
    return !state?.eliminated
  })

  batch.set(playerStateRef, nextPlayerState)

  if (activePlayersAfterGuess.length === 1) {
    const winner = activePlayersAfterGuess[0]
    const winnerName = winner?.name ?? 'The remaining player'

    batch.update(roomRef, {
      status: 'finished',
      winnerId: winner?.id ?? null,
      currentTurnPlayerId: null,
    })

    batch.set(doc(collection(db, 'rooms', roomCode, 'log')), {
      message: `${playerName} was eliminated. ${winnerName} wins as the last remaining player.`,
      createdAt: serverTimestamp(),
    })

    await batch.commit()

    return {
      correct: false,
      eliminated: true,
      wrongGuesses: penalty.wrongGuesses,
      gameFinished: true,
      winnerId: winner?.id ?? null,
    }
  }

  if (activePlayersAfterGuess.length === 0) {
    batch.update(roomRef, {
      status: 'finished',
      winnerId: null,
      currentTurnPlayerId: null,
    })

    batch.set(doc(collection(db, 'rooms', roomCode, 'log')), {
      message: `${playerName} was eliminated. No active players remain.`,
      createdAt: serverTimestamp(),
    })

    await batch.commit()

    return {
      correct: false,
      eliminated: true,
      wrongGuesses: penalty.wrongGuesses,
      gameFinished: true,
      winnerId: null,
    }
  }

  const nextTurnPlayerId = getNextActiveTurnPlayerId({
    players,
    states,
    currentPlayerId: params.playerId,
    currentPlayerNextState: nextPlayerState,
  })

  batch.update(roomRef, {
    currentTurnPlayerId: nextTurnPlayerId,
  })

  batch.set(doc(collection(db, 'rooms', roomCode, 'log')), {
    message: `${playerName} guessed incorrectly. Wrong guesses: ${penalty.wrongGuesses}.`,
    createdAt: serverTimestamp(),
  })

  await batch.commit()

  return {
    correct: false,
    eliminated: penalty.eliminated,
    wrongGuesses: penalty.wrongGuesses,
    gameFinished: false,
    winnerId: null,
  }
"""

if old not in text:
    raise SystemExit("Could not find the makeGuess penalty block to patch. The file may have changed.")

rooms_path.write_text(text.replace(old, new))
PY

python3 - <<'PY'
from pathlib import Path

guess_path = Path("src/pages/GuessPage.tsx")
text = guess_path.read_text()

old = """      if (result.correct) {
        navigate(`/winner/${roomCode}`)
        return
      }

      if (result.eliminated) {
        setMessage('Wrong guess. You are eliminated.')
      } else {
        setMessage(`Wrong guess. Wrong guesses: ${result.wrongGuesses}/3.`)
      }
"""

new = """      if (result.correct || result.gameFinished) {
        navigate(`/winner/${roomCode}`)
        return
      }

      if (result.eliminated) {
        setMessage('Wrong guess. You are eliminated.')
      } else {
        setMessage(`Wrong guess. Wrong guesses: ${result.wrongGuesses}/3.`)
      }
"""

if old not in text:
    raise SystemExit("Could not find the GuessPage result block to patch. The file may have changed.")

guess_path.write_text(text.replace(old, new))
PY

python3 - <<'PY'
from pathlib import Path

game_path = Path("src/pages/GamePage.tsx")
text = game_path.read_text()

text = text.replace(
"  const isYourTurn = room?.currentTurnPlayerId === user?.uid\n",
"  const isYourTurn = room?.currentTurnPlayerId === user?.uid\n  const isEliminated = playerState?.eliminated ?? false\n",
)

text = text.replace(
"""            <p className="font-bold">
              {isYourTurn ? 'Your turn' : `Waiting for ${currentTurnName}`}
            </p>""",
"""            <p className="font-bold">
              {isEliminated
                ? 'You are eliminated'
                : isYourTurn
                  ? 'Your turn'
                  : `Waiting for ${currentTurnName}`}
            </p>""",
)

text = text.replace(
"""            disabled={!isYourTurn || !selectedCardId || busy}""",
"""            disabled={!isYourTurn || isEliminated || !selectedCardId || busy}""",
)

text = text.replace(
"""                  disabled={!isYourTurn || busy}""",
"""                  disabled={!isYourTurn || isEliminated || busy}""",
)

marker = """            <div className="mt-4 grid grid-cols-2 gap-3">"""
insert = """            <div className="mt-4 rounded-xl bg-slate-950 p-4">
              <p className="text-sm text-slate-400">Wrong guesses</p>
              <p className="text-2xl font-black text-amber-300">
                {playerState?.wrongGuesses ?? 0}/3
              </p>
              {isEliminated ? (
                <p className="mt-1 text-sm font-semibold text-rose-300">
                  Eliminated
                </p>
              ) : null}
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3">"""
if marker in text and "Wrong guesses" not in text:
    text = text.replace(marker, insert, 1)

game_path.write_text(text)
PY

npm run check

echo ""
echo "Elimination patch complete."
echo "Run: npm run dev"
