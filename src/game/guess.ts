import type { Card, Guess } from '../types/card'

export type HiddenCluePileChoice = 'YES' | 'NO'

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

export function applyWrongGuessPenalty(
  previousWrongGuesses: number,
  pileToHide: HiddenCluePileChoice = 'YES',
): WrongGuessPenalty {
  const wrongGuesses = previousWrongGuesses + 1
  const hideBothPiles = wrongGuesses >= 2

  return {
    wrongGuesses,
    hideYesPile: hideBothPiles || pileToHide === 'YES',
    hideNoPile: hideBothPiles || pileToHide === 'NO',
    eliminated: wrongGuesses >= 3,
  }
}
