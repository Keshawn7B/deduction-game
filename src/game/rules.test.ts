import { describe, expect, it } from 'vitest'
import { createDeck } from './deck'
import { isCorrectGuess } from './guess'
import { getClueResult, validatePlayerCount } from './rules'

describe('game rules', () => {
  it('creates a unique deck', () => {
    const deck = createDeck()
    const ids = new Set(deck.map((card) => card.id))

    expect(deck.length).toBe(512)
    expect(ids.size).toBe(512)
  })

  it('validates player count', () => {
    expect(validatePlayerCount(1)).toBe(false)
    expect(validatePlayerCount(2)).toBe(true)
    expect(validatePlayerCount(4)).toBe(true)
    expect(validatePlayerCount(5)).toBe(false)
  })

  it('returns YES when a clue matches any identity attribute', () => {
    const identity = {
      id: 'Fox-Pirate-Beach',
      animal: 'Fox',
      disguise: 'Pirate',
      location: 'Beach',
    } as const

    const clue = {
      id: 'Dog-Pirate-Moon',
      animal: 'Dog',
      disguise: 'Pirate',
      location: 'Moon',
    } as const

    expect(getClueResult(clue, identity)).toBe('YES')
  })

  it('checks a correct full guess', () => {
    const identity = {
      id: 'Fox-Pirate-Beach',
      animal: 'Fox',
      disguise: 'Pirate',
      location: 'Beach',
    } as const

    expect(
      isCorrectGuess(identity, {
        animal: 'Fox',
        disguise: 'Pirate',
        location: 'Beach',
      }),
    ).toBe(true)
  })
})
