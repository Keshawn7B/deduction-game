import type { Card } from '../types/card'
import { createDeck, drawCards, shuffleDeck } from './deck'
import { validatePlayerCount } from './rules'

export type InitialPlayerState = {
  playerId: string
  hand: Card[]
  hiddenIdentity: Card
  yesPile: Card[]
  noPile: Card[]
  wrongGuesses: number
  eliminated: boolean
}

export type InitialGameState = {
  players: InitialPlayerState[]
  deck: Card[]
  discardPile: Card[]
  currentTurnPlayerId: string
}

export function createInitialGameState(
  playerIds: string[],
  random: () => number = Math.random,
): InitialGameState {
  if (!validatePlayerCount(playerIds.length)) {
    throw new Error('Game requires 2–4 players.')
  }

  let deck = shuffleDeck(createDeck(), random)

  const players: InitialPlayerState[] = playerIds.map((playerId) => {
    const identityDraw = drawCards(deck, 1)
    const hiddenIdentity = identityDraw.drawnCards[0]
    deck = identityDraw.remainingDeck

    const handDraw = drawCards(deck, 5)
    deck = handDraw.remainingDeck

    return {
      playerId,
      hand: handDraw.drawnCards,
      hiddenIdentity,
      yesPile: [],
      noPile: [],
      wrongGuesses: 0,
      eliminated: false,
    }
  })

  return {
    players,
    deck,
    discardPile: [],
    currentTurnPlayerId: playerIds[0],
  }
}
