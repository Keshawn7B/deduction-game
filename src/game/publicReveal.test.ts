import { describe, expect, it } from 'vitest'
import { appendPublicReveal, createPublicReveal } from './publicReveal'
import type { Card } from '../types/card'

const revealedCard: Card = {
  id: 'fox-detective-kitchen',
  animal: 'Fox',
  disguise: 'Detective',
  location: 'Kitchen',
}

function card(id: string): Card {
  return {
    id,
    animal: 'Fox',
    disguise: 'Detective',
    location: 'Kitchen',
  }
}

describe('public reveal visibility', () => {
  it('records only the table-visible card and result for everyone', () => {
    expect(
      createPublicReveal({
        playerId: 'player-1',
        playerName: 'Avery',
        card: revealedCard,
        result: 'YES',
      }),
    ).toEqual({
      playerId: 'player-1',
      playerName: 'Avery',
      card: revealedCard,
      result: 'YES',
    })
  })

  it('keeps hidden identity and private hand data out of the public reveal', () => {
    const publicReveal = createPublicReveal({
      playerId: 'player-1',
      playerName: 'Avery',
      card: revealedCard,
      result: 'NO',
    })

    expect(publicReveal).not.toHaveProperty('hiddenIdentity')
    expect(publicReveal).not.toHaveProperty('hand')
    expect(publicReveal).not.toHaveProperty('deck')
  })

  it('appends each reveal to a public table trail in newest-first order', () => {
    const first = createPublicReveal({
      playerId: 'player-1',
      playerName: 'Avery',
      card: card('first-card'),
      result: 'YES',
    })
    const second = createPublicReveal({
      playerId: 'player-2',
      playerName: 'Blake',
      card: card('second-card'),
      result: 'NO',
    })

    expect(appendPublicReveal([first], second)).toEqual([second, first])
  })

  it('caps the public table trail so old turns do not bloat the room document', () => {
    const history = Array.from({ length: 8 }, (_, index) =>
      createPublicReveal({
        playerId: `player-${index}`,
        playerName: `Player ${index}`,
        card: card(`card-${index}`),
        result: index % 2 === 0 ? 'YES' : 'NO',
      }),
    )
    const latest = createPublicReveal({
      playerId: 'latest-player',
      playerName: 'Latest Player',
      card: card('latest-card'),
      result: 'YES',
    })

    const nextHistory = appendPublicReveal(history, latest)

    expect(nextHistory).toHaveLength(8)
    expect(nextHistory[0]).toBe(latest)
    expect(nextHistory.at(-1)?.card.id).toBe('card-6')
  })
})
