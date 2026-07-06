import type { Card, CardSetSize, ClueResult } from '../types/card'
import { createDeck, drawCards, shuffleDeck } from './deck'
import { getClueResult, validatePlayerCount } from './rules'

export type InitialPlayerState = {
  playerId: string
  hand: Card[]
  hiddenIdentity: Card
  yesPile: Card[]
  noPile: Card[]
  wrongGuesses: number
  eliminated: boolean
}

export type StartingCluesMode = 'automatic' | 'playerChoice'

export type InitialGameStateOptions = {
  startingClues?: StartingCluesMode
}

export type InitialGameState = {
  players: InitialPlayerState[]
  deck: Card[]
  discardPile: Card[]
  currentTurnPlayerId: string
}

function drawClueForIdentity(
  deck: Card[],
  hiddenIdentity: Card,
  result: ClueResult,
) {
  const clueIndex = deck.findIndex(
    (card) => getClueResult(card, hiddenIdentity) === result,
  )

  if (clueIndex === -1) {
    throw new Error(`Could not find a ${result} starting clue.`)
  }

  const clueCard = deck[clueIndex]

  return {
    clueCard,
    remainingDeck: deck.filter((_, index) => index !== clueIndex),
  }
}

function createUndealtPlayers(playerIds: string[], deck: Card[]) {
  const players: InitialPlayerState[] = []
  let remainingDeck = deck

  for (const playerId of playerIds) {
    const identityDraw = drawCards(remainingDeck, 1)
    remainingDeck = identityDraw.remainingDeck

    players.push({
      playerId,
      hand: [],
      hiddenIdentity: identityDraw.drawnCards[0],
      yesPile: [],
      noPile: [],
      wrongGuesses: 0,
      eliminated: false,
    })
  }

  return { players, remainingDeck }
}

export function createInitialGameState(
  playerIds: string[],
  random: () => number = Math.random,
  cardSetSize: CardSetSize = 8,
  options: InitialGameStateOptions = {},
): InitialGameState {
  if (!validatePlayerCount(playerIds.length)) {
    throw new Error('Game requires 2–4 players.')
  }

  let deck = shuffleDeck(createDeck(cardSetSize), random)
  const startingClues = options.startingClues ?? 'automatic'
  const initialPlayers = createUndealtPlayers(playerIds, deck)
  const players = initialPlayers.players
  deck = initialPlayers.remainingDeck

  if (startingClues === 'playerChoice') {
    for (const [index, player] of players.entries()) {
      const receiver = players[(index + 1) % players.length]
      const yesClueDraw = drawClueForIdentity(deck, receiver.hiddenIdentity, 'YES')
      deck = yesClueDraw.remainingDeck

      const noClueDraw = drawClueForIdentity(deck, receiver.hiddenIdentity, 'NO')
      deck = noClueDraw.remainingDeck

      const fillerDraw = drawCards(deck, 3)
      deck = fillerDraw.remainingDeck
      player.hand = [
        yesClueDraw.clueCard,
        noClueDraw.clueCard,
        ...fillerDraw.drawnCards,
      ]
    }

    return {
      players,
      deck,
      discardPile: [],
      currentTurnPlayerId: playerIds[0],
    }
  }

  for (const player of players) {
    const handDraw = drawCards(deck, 5)
    deck = handDraw.remainingDeck

    const yesClueDraw = drawClueForIdentity(deck, player.hiddenIdentity, 'YES')
    deck = yesClueDraw.remainingDeck

    const noClueDraw = drawClueForIdentity(deck, player.hiddenIdentity, 'NO')
    deck = noClueDraw.remainingDeck

    player.hand = handDraw.drawnCards
    player.yesPile = [yesClueDraw.clueCard]
    player.noPile = [noClueDraw.clueCard]
  }

  return {
    players,
    deck,
    discardPile: [],
    currentTurnPlayerId: playerIds[0],
  }
}
