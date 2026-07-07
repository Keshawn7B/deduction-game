import { describe, expect, it } from 'vitest'
import { getLegendGroups } from '../../game/cardSetLegend'

const groupNames = ['animals', 'backgrounds', 'accessories'] as const

describe('getLegendGroups', () => {
  it('limits the legend to the active card set size', () => {
    for (const cardSetSize of [6, 7, 8] as const) {
      const groups = getLegendGroups(cardSetSize)

      expect(groups.map((group) => group.title)).toEqual([
        `${cardSetSize} animals`,
        `${cardSetSize} backgrounds`,
        `${cardSetSize} accessories`,
      ])

      for (const groupName of groupNames) {
        expect(groups.find((group) => group.name === groupName)?.items).toHaveLength(
          cardSetSize,
        )
      }
    }
  })

  it('uses the same first options as the active game deck', () => {
    const groups = getLegendGroups(7)

    expect(groups.find((group) => group.name === 'animals')?.items.map((item) => item.name)).toEqual([
      'Fox',
      'Dog',
      'Cat',
      'Bear',
      'Rabbit',
      'Penguin',
      'Lizard',
    ])
    expect(
      groups.find((group) => group.name === 'backgrounds')?.items.map((item) => item.name),
    ).toEqual(['Beach', 'Moon', 'Castle', 'Forest', 'Museum', 'Kitchen', 'Volcano'])
    expect(
      groups.find((group) => group.name === 'accessories')?.items.map((item) => item.name),
    ).toEqual(['Pirate', 'Wizard', 'Detective', 'Crown', 'Goggles', 'Flowers', 'Shades'])
  })
})
