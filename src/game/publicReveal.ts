import type { Card, ClueResult } from '../types/card'

export const PUBLIC_REVEAL_HISTORY_LIMIT = 8

export type PublicReveal = {
  playerId: string
  playerName: string
  card: Card
  result: ClueResult
}

export function createPublicReveal(params: PublicReveal): PublicReveal {
  return {
    playerId: params.playerId,
    playerName: params.playerName,
    card: params.card,
    result: params.result,
  }
}

export function appendPublicReveal(
  history: PublicReveal[] | undefined,
  reveal: PublicReveal,
  limit = PUBLIC_REVEAL_HISTORY_LIMIT,
): PublicReveal[] {
  return [reveal, ...(history ?? [])].slice(0, limit)
}
