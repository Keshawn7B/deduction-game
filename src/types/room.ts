export type RoomStatus = 'lobby' | 'playing' | 'finished'

export type RoomDoc = {
  roomCode: string
  hostId: string
  status: RoomStatus
  currentTurnPlayerId: string | null
  winnerId: string | null
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
}
