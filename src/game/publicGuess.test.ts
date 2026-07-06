import { describe, expect, it } from 'vitest'
import { appendPublicGuess, createPublicGuess } from './publicGuess'
import type { Guess } from '../types/card'

const guess: Guess = {
  animal: 'Fox',
  disguise: 'Detective',
  location: 'Kitchen',
}

function makeGuess(id: number) {
  return createPublicGuess({
    playerId: `player-${id}`,
    playerName: `Player ${id}`,
    guess: {
      animal: id % 2 === 0 ? 'Fox' : 'Cat',
      disguise: 'Detective',
      location: 'Kitchen',
    },
    correct: id % 2 === 0,
    turnNumber: id,
  })
}

describe('public guess visibility', () => {
  it('records who guessed, what they guessed, whether it was correct, and when it happened', () => {
    expect(
      createPublicGuess({
        playerId: 'player-1',
        playerName: 'Avery',
        guess,
        correct: false,
        turnNumber: 3,
      }),
    ).toEqual({
      playerId: 'player-1',
      playerName: 'Avery',
      guess,
      correct: false,
      turnNumber: 3,
    })
  })

  it('keeps hidden identity and private state out of the public guess', () => {
    const publicGuess = createPublicGuess({
      playerId: 'player-1',
      playerName: 'Avery',
      guess,
      correct: false,
      turnNumber: 3,
    })

    expect(publicGuess).not.toHaveProperty('hiddenIdentity')
    expect(publicGuess).not.toHaveProperty('hand')
    expect(publicGuess).not.toHaveProperty('deck')
    expect(publicGuess).not.toHaveProperty('yesPile')
    expect(publicGuess).not.toHaveProperty('noPile')
  })

  it('appends guesses newest-first and caps history', () => {
    const history = Array.from({ length: 8 }, (_, index) => makeGuess(8 - index))
    const latest = makeGuess(9)

    const nextHistory = appendPublicGuess(history, latest)

    expect(nextHistory).toHaveLength(8)
    expect(nextHistory[0]).toBe(latest)
    expect(nextHistory.at(-1)?.turnNumber).toBe(2)
  })
})
