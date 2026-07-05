import type { Card, Guess } from '../types/card'

export type WrongGuessPenalty = {
  wrongGuesses: number
  hideYesPile: boolean
  hideNoPile: boolean
  eliminated: boolean
}

export function isCorrectGuess(hiddenIdentity: Card, guess: Guess): boolean {
  return (
    hiddenIdentity.animal === guess.animal &&
    hiddenIdentity.disguise === guess.disguise &&
    hiddenIdentity.location === guess.location
  )
}

export function applyWrongGuessPenalty(previousWrongGuesses: number): WrongGuessPenalty {
  const wrongGuesses = previousWrongGuesses + 1

  return {
    wrongGuesses,
    hideYesPile: wrongGuesses >= 1,
    hideNoPile: wrongGuesses >= 2,
    eliminated: wrongGuesses >= 3,
  }
}
