import type { Card } from './card'

export type PlayerGameState = {
  playerId: string
  hand: Card[]
  yesPile: Card[]
  noPile: Card[]
  hideYesPile: boolean
  hideNoPile: boolean
  wrongGuesses: number
  eliminated: boolean
}

export type PlayerIdentityDoc = {
  playerId: string
  hiddenIdentity: Card
}

export type PrivateDeckDoc = {
  deck: Card[]
  discardPile: Card[]
}
