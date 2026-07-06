import { describe, expect, it } from 'vitest'
import { createDeck, getCardSetOptions } from './deck'
import { isCorrectGuess } from './guess'
import { getClueResult, validatePlayerCount } from './rules'
import { createInitialGameState } from './setup'

describe('game rules', () => {
  it('creates a unique deck', () => {
    const deck = createDeck()
    const ids = new Set(deck.map((card) => card.id))

    expect(deck.length).toBe(512)
    expect(ids.size).toBe(512)
  })

  it('creates smaller unique decks for lobby card set choices', () => {
    for (const cardSetSize of [4, 6, 8] as const) {
      const deck = createDeck(cardSetSize)
      const ids = new Set(deck.map((card) => card.id))

      expect(deck).toHaveLength(cardSetSize ** 3)
      expect(ids.size).toBe(cardSetSize ** 3)
    }
  })

  it('returns matching guess choices for each lobby card set size', () => {
    expect(getCardSetOptions(4)).toEqual({
      animals: ['Fox', 'Dog', 'Cat', 'Bear'],
      disguises: ['Pirate', 'Wizard', 'Detective', 'Crown'],
      locations: ['Beach', 'Moon', 'Castle', 'Forest'],
    })

    expect(getCardSetOptions(6)).toEqual({
      animals: ['Fox', 'Dog', 'Cat', 'Bear', 'Rabbit', 'Penguin'],
      disguises: ['Pirate', 'Wizard', 'Detective', 'Crown', 'Goggles', 'Flowers'],
      locations: ['Beach', 'Moon', 'Castle', 'Forest', 'Museum', 'Kitchen'],
    })

    expect(getCardSetOptions(8)).toEqual({
      animals: ['Fox', 'Dog', 'Cat', 'Bear', 'Rabbit', 'Penguin', 'Lizard', 'Owl'],
      disguises: ['Pirate', 'Wizard', 'Detective', 'Crown', 'Goggles', 'Flowers', 'Shades', 'Explorer'],
      locations: ['Beach', 'Moon', 'Castle', 'Forest', 'Museum', 'Kitchen', 'Volcano', 'Library'],
    })
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

  it('starts each player with one valid YES clue and one valid NO clue', () => {
    const state = createInitialGameState(['player-1', 'player-2'], () => 0.5)

    for (const player of state.players) {
      expect(player.yesPile).toHaveLength(1)
      expect(player.noPile).toHaveLength(1)
      expect(getClueResult(player.yesPile[0], player.hiddenIdentity)).toBe('YES')
      expect(getClueResult(player.noPile[0], player.hiddenIdentity)).toBe('NO')
      expect(player.yesPile[0].id).not.toBe(player.noPile[0].id)
      expect(player.hand.map((card) => card.id)).not.toContain(player.yesPile[0].id)
      expect(player.hand.map((card) => card.id)).not.toContain(player.noPile[0].id)
    }

    expect(state.deck).toHaveLength(512 - state.players.length * 8)
  })

  it('uses the selected lobby card set size when creating initial state', () => {
    for (const cardSetSize of [4, 6, 8] as const) {
      const state = createInitialGameState(
        ['player-1', 'player-2'],
        () => 0.5,
        cardSetSize,
      )

      expect(state.deck).toHaveLength(cardSetSize ** 3 - state.players.length * 8)
    }
  })

  it('lets players choose starting clues while keeping piles empty at deal time', () => {
    const state = createInitialGameState(['player-1', 'player-2'], () => 0.5, 8, {
      startingClues: 'playerChoice',
    })

    for (const player of state.players) {
      expect(player.yesPile).toHaveLength(0)
      expect(player.noPile).toHaveLength(0)
      expect(player.hand).toHaveLength(5)
    }

    expect(state.deck).toHaveLength(512 - state.players.length * 6)
  })

  it('guarantees each player can choose at least one YES and one NO starting clue for the next player', () => {
    const state = createInitialGameState(['player-1', 'player-2'], () => 0.5, 8, {
      startingClues: 'playerChoice',
    })

    for (const [index, player] of state.players.entries()) {
      const receiver = state.players[(index + 1) % state.players.length]
      const clueResults = player.hand.map((card) =>
        getClueResult(card, receiver.hiddenIdentity),
      )

      expect(clueResults).toContain('YES')
      expect(clueResults).toContain('NO')
    }
  })
})
