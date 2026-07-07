import type { PublicGuess } from '../game/publicGuess'
import type { PublicReveal } from '../game/publicReveal'
import type { StartingCluesMode } from '../game/setup'
import type { Card, CardSetSize } from './card'
export type PendingReveal = {
  playerId: string
  responderId: string
  card: Card
}

export type RoomStatus = 'lobby' | 'setupClues' | 'playing' | 'finished'

export type RoomDoc = {
  roomCode: string
  hostId: string
  status: RoomStatus
  currentTurnPlayerId: string | null
  manualResponses?: boolean
  cardSetSize?: CardSetSize
  startingCluesMode?: StartingCluesMode
  pendingReveal?: PendingReveal | null
  lastReveal?: PublicReveal | null
  publicReveals?: PublicReveal[]
  publicGuesses?: PublicGuess[]
  turnNumber?: number
  winnerId: string | null
  playerCount?: number
  createdAt: unknown
}

export type LobbyPlayer = {
  id: string
  name: string
  ready: boolean
  isHost: boolean
  joinedAt: unknown
  wrongGuesses?: number
  eliminated?: boolean
  yesPile?: Card[]
  noPile?: Card[]
  hideYesPile?: boolean
  hideNoPile?: boolean
}
