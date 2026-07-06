import type { Guess } from '../types/card'

export const PUBLIC_GUESS_HISTORY_LIMIT = 8

export type PublicGuess = {
  playerId: string
  playerName: string
  guess: Guess
  correct: boolean
  turnNumber: number
}

export function createPublicGuess(params: PublicGuess): PublicGuess {
  return {
    playerId: params.playerId,
    playerName: params.playerName,
    guess: params.guess,
    correct: params.correct,
    turnNumber: params.turnNumber,
  }
}

export function appendPublicGuess(
  history: PublicGuess[] | undefined,
  guess: PublicGuess,
  limit = PUBLIC_GUESS_HISTORY_LIMIT,
): PublicGuess[] {
  return [guess, ...(history ?? [])].slice(0, limit)
}
