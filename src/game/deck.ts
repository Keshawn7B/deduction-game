import type { Animal, Card, CardSetSize, Disguise, Location } from '../types/card'

export const ANIMALS: Animal[] = [
  'Fox',
  'Dog',
  'Cat',
  'Bear',
  'Rabbit',
  'Penguin',
  'Lizard',
  'Owl',
]

export const DISGUISES: Disguise[] = [
  'Pirate',
  'Wizard',
  'Detective',
  'Crown',
  'Goggles',
  'Flowers',
  'Shades',
  'Explorer',
]

export const LOCATIONS: Location[] = [
  'Beach',
  'Moon',
  'Castle',
  'Forest',
  'Museum',
  'Kitchen',
  'Volcano',
  'Library',
]

export const CARD_SET_SIZES = [4, 6, 8] as const
export const DEFAULT_CARD_SET_SIZE: CardSetSize = 8

export type CardSetOptions = {
  animals: Animal[]
  disguises: Disguise[]
  locations: Location[]
}

export function isCardSetSize(value: number): value is CardSetSize {
  return CARD_SET_SIZES.includes(value as CardSetSize)
}

export function normalizeCardSetSize(value: unknown): CardSetSize {
  return typeof value === 'number' && isCardSetSize(value)
    ? value
    : DEFAULT_CARD_SET_SIZE
}

export function getCardSetOptions(
  cardSetSize: CardSetSize = DEFAULT_CARD_SET_SIZE,
): CardSetOptions {
  return {
    animals: ANIMALS.slice(0, cardSetSize),
    disguises: DISGUISES.slice(0, cardSetSize),
    locations: LOCATIONS.slice(0, cardSetSize),
  }
}

export function createDeck(
  cardSetSize: CardSetSize = DEFAULT_CARD_SET_SIZE,
): Card[] {
  const cards: Card[] = []
  const { animals, disguises, locations } = getCardSetOptions(cardSetSize)

  for (const animal of animals) {
    for (const disguise of disguises) {
      for (const location of locations) {
        cards.push({
          id: `${animal}-${disguise}-${location}`,
          animal,
          disguise,
          location,
        })
      }
    }
  }

  return cards
}

export function shuffleDeck(cards: Card[], random = Math.random): Card[] {
  const shuffledCards = [...cards]

  for (let index = shuffledCards.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1))
    const currentCard = shuffledCards[index]
    const swapCard = shuffledCards[swapIndex]

    shuffledCards[index] = swapCard
    shuffledCards[swapIndex] = currentCard
  }

  return shuffledCards
}

export function drawCards(deck: Card[], count: number) {
  const drawnCards = deck.slice(0, count)

  return {
    drawnCards,
    drawn: drawnCards,
    remainingDeck: deck.slice(count),
  }
}
