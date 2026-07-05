import type { Card, ClueResult } from '../types/card'

export function hasAnyMatchingAttribute(card: Card, hiddenIdentity: Card): boolean {
  return (
    card.animal === hiddenIdentity.animal ||
    card.disguise === hiddenIdentity.disguise ||
    card.location === hiddenIdentity.location
  )
}

export function getClueResult(card: Card, hiddenIdentity: Card): ClueResult {
  return hasAnyMatchingAttribute(card, hiddenIdentity) ? 'YES' : 'NO'
}

export function validatePlayerCount(playerCount: number): boolean {
  return playerCount >= 2 && playerCount <= 4
}

export function getPlayerOnLeft(playerIds: string[], currentPlayerId: string): string {
  const currentIndex = playerIds.indexOf(currentPlayerId)

  if (currentIndex === -1) {
    throw new Error('Current player is not in the player list.')
  }

  const leftIndex = (currentIndex + 1) % playerIds.length
  return playerIds[leftIndex]
}
