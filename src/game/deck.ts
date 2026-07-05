import type { Animal, Card, Disguise, Location } from '../types/card'

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

export function createDeck(): Card[] {
  const cards: Card[] = []

  for (const animal of ANIMALS) {
    for (const disguise of DISGUISES) {
      for (const location of LOCATIONS) {
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
