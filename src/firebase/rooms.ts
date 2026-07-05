import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
  type Unsubscribe,
} from 'firebase/firestore'
import { applyWrongGuessPenalty, isCorrectGuess } from '../game/guess'
import { getClueResult } from '../game/rules'
import { createInitialGameState } from '../game/setup'
import type { Card, Guess } from '../types/card'
import type {
  PlayerGameState,
  PlayerIdentityDoc,
  PrivateDeckDoc,
} from '../types/game'
import type { GameLogEntry } from '../types/log'
import type { LobbyPlayer, RoomDoc } from '../types/room'
import { createRoomCode, normalizeRoomCode } from '../utils/roomCode'
import { db } from './client'

const MAX_PLAYERS = 4

type MutableInitialPlayerState = {
  playerId: string
  hand: Card[]
  hiddenIdentity: Card
  yesPile: Card[]
  noPile: Card[]
  wrongGuesses: number
  eliminated: boolean
}

function getPlayerSortValue(player: LobbyPlayer): number {
  const joinedAt = player.joinedAt as { seconds?: number } | null

  if (joinedAt?.seconds) {
    return joinedAt.seconds
  }

  return 0
}

function sortPlayers(players: LobbyPlayer[]): LobbyPlayer[] {
  return [...players].sort((a, b) => {
    const joinedDiff = getPlayerSortValue(a) - getPlayerSortValue(b)

    if (joinedDiff !== 0) {
      return joinedDiff
    }

    return a.name.localeCompare(b.name)
  })
}

function drawOne(deck: Card[]) {
  const [drawnCard, ...remainingDeck] = deck

  return {
    drawnCard: drawnCard ?? null,
    remainingDeck,
  }
}

function getNextActiveTurnPlayerId(params: {
  players: LobbyPlayer[]
  states: PlayerGameState[]
  currentPlayerId: string
  currentPlayerNextState?: PlayerGameState
}): string {
  const stateByPlayerId = new Map(
    params.states.map((state) => [state.playerId, state]),
  )

  if (params.currentPlayerNextState) {
    stateByPlayerId.set(
      params.currentPlayerNextState.playerId,
      params.currentPlayerNextState,
    )
  }

  const activePlayers = sortPlayers(params.players).filter((player) => {
    const state = stateByPlayerId.get(player.id)
    return !state?.eliminated
  })

  if (activePlayers.length === 0) {
    return params.currentPlayerId
  }

  const currentIndex = activePlayers.findIndex(
    (player) => player.id === params.currentPlayerId,
  )

  if (currentIndex === -1) {
    return activePlayers[0].id
  }

  const nextIndex = (currentIndex + 1) % activePlayers.length
  return activePlayers[nextIndex].id
}

function applyInitialClueExchange(params: {
  players: LobbyPlayer[]
  playerStates: MutableInitialPlayerState[]
  deck: Card[]
}) {
  const stateByPlayerId = new Map(
    params.playerStates.map((state) => [state.playerId, state]),
  )
  let deck = [...params.deck]

  for (let index = 0; index < params.players.length; index += 1) {
    const giver = params.players[index]
    const receiver = params.players[(index + 1) % params.players.length]
    const giverState = stateByPlayerId.get(giver.id)
    const receiverState = stateByPlayerId.get(receiver.id)

    if (!giverState || !receiverState) {
      continue
    }

    const [clueCard, ...remainingHand] = giverState.hand

    if (!clueCard) {
      continue
    }

    const draw = drawOne(deck)
    deck = draw.remainingDeck

    giverState.hand = draw.drawnCard
      ? [...remainingHand, draw.drawnCard]
      : remainingHand

    const result = getClueResult(clueCard, receiverState.hiddenIdentity)

    if (result === 'YES') {
      receiverState.yesPile = [...receiverState.yesPile, clueCard]
    } else {
      receiverState.noPile = [...receiverState.noPile, clueCard]
    }
  }

  return {
    playerStates: [...stateByPlayerId.values()],
    deck,
  }
}

async function getLobbyPlayers(roomCode: string): Promise<LobbyPlayer[]> {
  const playersSnap = await getDocs(collection(db, 'rooms', roomCode, 'players'))

  return sortPlayers(
    playersSnap.docs.map((playerDoc) => ({
      id: playerDoc.id,
      ...(playerDoc.data() as Omit<LobbyPlayer, 'id'>),
    })),
  )
}

async function getPlayerStates(roomCode: string): Promise<PlayerGameState[]> {
  const statesSnap = await getDocs(collection(db, 'rooms', roomCode, 'playerStates'))

  return statesSnap.docs.map((stateDoc) => stateDoc.data() as PlayerGameState)
}

export async function createRoom(params: {
  hostId: string
  playerName: string
}): Promise<string> {
  const playerName = params.playerName.trim()

  if (!playerName) {
    throw new Error('Enter a player name.')
  }

  for (let attempt = 0; attempt < 10; attempt += 1) {
    const roomCode = createRoomCode()
    const roomRef = doc(db, 'rooms', roomCode)
    const existingRoom = await getDoc(roomRef)

    if (existingRoom.exists()) {
      continue
    }

    await setDoc(roomRef, {
      roomCode,
      hostId: params.hostId,
      status: 'lobby',
      currentTurnPlayerId: null,
      winnerId: null,
      createdAt: serverTimestamp(),
    })

    await setDoc(doc(db, 'rooms', roomCode, 'players', params.hostId), {
      name: playerName,
      ready: true,
      isHost: true,
      joinedAt: serverTimestamp(),
      wrongGuesses: 0,
      eliminated: false,
    })

    return roomCode
  }

  throw new Error('Could not create a unique room code. Try again.')
}

export async function joinRoom(params: {
  roomCode: string
  playerId: string
  playerName: string
}): Promise<string> {
  const roomCode = normalizeRoomCode(params.roomCode)
  const playerName = params.playerName.trim()

  if (!roomCode) {
    throw new Error('Enter a room code.')
  }

  if (!playerName) {
    throw new Error('Enter a player name.')
  }

  const roomRef = doc(db, 'rooms', roomCode)
  const roomSnap = await getDoc(roomRef)

  if (!roomSnap.exists()) {
    throw new Error('Room not found.')
  }

  const room = roomSnap.data() as RoomDoc

  if (room.status !== 'lobby') {
    throw new Error('This game has already started.')
  }

  const playersSnap = await getDocs(collection(db, 'rooms', roomCode, 'players'))
  const alreadyJoined = playersSnap.docs.some(
    (player) => player.id === params.playerId,
  )

  if (!alreadyJoined && playersSnap.size >= MAX_PLAYERS) {
    throw new Error('This room is full.')
  }

  await setDoc(
    doc(db, 'rooms', roomCode, 'players', params.playerId),
    {
      name: playerName,
      ready: false,
      isHost: room.hostId === params.playerId,
      joinedAt: serverTimestamp(),
      wrongGuesses: 0,
      eliminated: false,
    },
    { merge: true },
  )

  return roomCode
}

export async function startGame(params: {
  roomCode: string
  hostId: string
}) {
  const roomCode = normalizeRoomCode(params.roomCode)
  const roomRef = doc(db, 'rooms', roomCode)
  const roomSnap = await getDoc(roomRef)

  if (!roomSnap.exists()) {
    throw new Error('Room not found.')
  }

  const room = roomSnap.data() as RoomDoc

  if (room.hostId !== params.hostId) {
    throw new Error('Only the host can start the game.')
  }

  if (room.status !== 'lobby') {
    throw new Error('This game has already started.')
  }

  const players = await getLobbyPlayers(roomCode)

  if (players.length < 2 || players.length > 4) {
    throw new Error('Game requires 2–4 players.')
  }

  if (!players.every((player) => player.ready)) {
    throw new Error('Every player must be ready.')
  }

  const initialGameState = createInitialGameState(
    players.map((player) => player.id),
  )

  const initialExchange = applyInitialClueExchange({
    players,
    playerStates: initialGameState.players.map((state) => ({
      playerId: state.playerId,
      hand: [...state.hand],
      hiddenIdentity: state.hiddenIdentity,
      yesPile: [...state.yesPile],
      noPile: [...state.noPile],
      wrongGuesses: state.wrongGuesses,
      eliminated: state.eliminated,
    })),
    deck: initialGameState.deck,
  })

  const batch = writeBatch(db)

  for (const playerState of initialExchange.playerStates) {
    const state: PlayerGameState = {
      playerId: playerState.playerId,
      hand: playerState.hand,
      yesPile: playerState.yesPile,
      noPile: playerState.noPile,
      hideYesPile: false,
      hideNoPile: false,
      wrongGuesses: playerState.wrongGuesses,
      eliminated: playerState.eliminated,
    }

    const identity: PlayerIdentityDoc = {
      playerId: playerState.playerId,
      hiddenIdentity: playerState.hiddenIdentity,
    }

    batch.set(
      doc(db, 'rooms', roomCode, 'playerStates', playerState.playerId),
      state,
    )

    batch.set(
      doc(db, 'rooms', roomCode, 'identities', playerState.playerId),
      identity,
    )

    batch.update(doc(db, 'rooms', roomCode, 'players', playerState.playerId), {
      wrongGuesses: 0,
      eliminated: false,
    })
  }

  batch.set(doc(db, 'rooms', roomCode, 'privateDeck', 'state'), {
    deck: initialExchange.deck,
    discardPile: initialGameState.discardPile,
  })

  batch.set(doc(collection(db, 'rooms', roomCode, 'log')), {
    message: 'Game started. Cards were dealt.',
    createdAt: serverTimestamp(),
  })

  batch.set(doc(collection(db, 'rooms', roomCode, 'log')), {
    message:
      'Initial clues were exchanged. Each player gave one card to the player on their left.',
    createdAt: serverTimestamp(),
  })

  batch.update(roomRef, {
    status: 'playing',
    currentTurnPlayerId: initialGameState.currentTurnPlayerId,
  })

  await batch.commit()
}

export async function revealCard(params: {
  roomCode: string
  playerId: string
  cardId: string
}) {
  const roomCode = normalizeRoomCode(params.roomCode)
  const roomRef = doc(db, 'rooms', roomCode)
  const playerStateRef = doc(db, 'rooms', roomCode, 'playerStates', params.playerId)
  const identityRef = doc(db, 'rooms', roomCode, 'identities', params.playerId)
  const deckRef = doc(db, 'rooms', roomCode, 'privateDeck', 'state')

  const [roomSnap, playerStateSnap, identitySnap, deckSnap, players, states] =
    await Promise.all([
      getDoc(roomRef),
      getDoc(playerStateRef),
      getDoc(identityRef),
      getDoc(deckRef),
      getLobbyPlayers(roomCode),
      getPlayerStates(roomCode),
    ])

  if (!roomSnap.exists()) {
    throw new Error('Room not found.')
  }

  if (!playerStateSnap.exists()) {
    throw new Error('Player state not found.')
  }

  if (!identitySnap.exists()) {
    throw new Error('Identity not found.')
  }

  if (!deckSnap.exists()) {
    throw new Error('Deck not found.')
  }

  const room = roomSnap.data() as RoomDoc
  const playerState = playerStateSnap.data() as PlayerGameState
  const identity = identitySnap.data() as PlayerIdentityDoc
  const deckState = deckSnap.data() as PrivateDeckDoc

  if (room.status !== 'playing') {
    throw new Error('The game is not currently active.')
  }

  if (room.currentTurnPlayerId !== params.playerId) {
    throw new Error('It is not your turn.')
  }

  if (playerState.eliminated) {
    throw new Error('You are eliminated.')
  }

  const revealedCard = playerState.hand.find((card) => card.id === params.cardId)

  if (!revealedCard) {
    throw new Error('Card is not in your hand.')
  }

  const result = getClueResult(revealedCard, identity.hiddenIdentity)
  const handWithoutCard = playerState.hand.filter(
    (card) => card.id !== params.cardId,
  )
  const { drawnCard, remainingDeck } = drawOne(deckState.deck)
  const nextHand = drawnCard ? [...handWithoutCard, drawnCard] : handWithoutCard

  const nextPlayerState: PlayerGameState = {
    ...playerState,
    hand: nextHand,
    yesPile:
      result === 'YES'
        ? [...playerState.yesPile, revealedCard]
        : playerState.yesPile,
    noPile:
      result === 'NO'
        ? [...playerState.noPile, revealedCard]
        : playerState.noPile,
  }

  const nextDeckState: PrivateDeckDoc = {
    deck: remainingDeck,
    discardPile: deckState.discardPile,
  }

  const nextTurnPlayerId = getNextActiveTurnPlayerId({
    players,
    states,
    currentPlayerId: params.playerId,
    currentPlayerNextState: nextPlayerState,
  })
  const playerName =
    players.find((player) => player.id === params.playerId)?.name ?? 'A player'

  const batch = writeBatch(db)

  batch.set(playerStateRef, nextPlayerState)
  batch.set(deckRef, nextDeckState)
  batch.update(roomRef, {
    currentTurnPlayerId: nextTurnPlayerId,
  })
  batch.set(doc(collection(db, 'rooms', roomCode, 'log')), {
    message: `${playerName} revealed a card. Result: ${result}.`,
    createdAt: serverTimestamp(),
  })

  await batch.commit()

  return result
}

export async function makeGuess(params: {
  roomCode: string
  playerId: string
  guess: Guess
}) {
  const roomCode = normalizeRoomCode(params.roomCode)
  const roomRef = doc(db, 'rooms', roomCode)
  const playerStateRef = doc(db, 'rooms', roomCode, 'playerStates', params.playerId)
  const identityRef = doc(db, 'rooms', roomCode, 'identities', params.playerId)

  const [roomSnap, playerStateSnap, identitySnap, players, states] =
    await Promise.all([
      getDoc(roomRef),
      getDoc(playerStateRef),
      getDoc(identityRef),
      getLobbyPlayers(roomCode),
      getPlayerStates(roomCode),
    ])

  if (!roomSnap.exists()) {
    throw new Error('Room not found.')
  }

  if (!playerStateSnap.exists()) {
    throw new Error('Player state not found.')
  }

  if (!identitySnap.exists()) {
    throw new Error('Identity not found.')
  }

  const room = roomSnap.data() as RoomDoc
  const playerState = playerStateSnap.data() as PlayerGameState
  const identity = identitySnap.data() as PlayerIdentityDoc

  if (room.status !== 'playing') {
    throw new Error('The game is not currently active.')
  }

  if (room.currentTurnPlayerId !== params.playerId) {
    throw new Error('It is not your turn.')
  }

  if (playerState.eliminated) {
    throw new Error('You are eliminated.')
  }

  const playerName =
    players.find((player) => player.id === params.playerId)?.name ?? 'A player'

  const correct = isCorrectGuess(identity.hiddenIdentity, params.guess)
  const batch = writeBatch(db)

  if (correct) {
    batch.update(roomRef, {
      status: 'finished',
      winnerId: params.playerId,
      currentTurnPlayerId: null,
    })

    batch.set(doc(collection(db, 'rooms', roomCode, 'log')), {
      message: `${playerName} guessed correctly and won the game.`,
      createdAt: serverTimestamp(),
    })

    await batch.commit()

    return {
      correct: true,
      eliminated: false,
      wrongGuesses: playerState.wrongGuesses,
      gameFinished: true,
      winnerId: params.playerId,
    }
  }

  const penalty = applyWrongGuessPenalty(playerState.wrongGuesses)

  const nextPlayerState: PlayerGameState = {
    ...playerState,
    wrongGuesses: penalty.wrongGuesses,
    hideYesPile: penalty.hideYesPile,
    hideNoPile: penalty.hideNoPile,
    eliminated: penalty.eliminated,
  }

  const stateByPlayerId = new Map(states.map((state) => [state.playerId, state]))
  stateByPlayerId.set(params.playerId, nextPlayerState)

  const activePlayersAfterGuess = players.filter((player) => {
    const state = stateByPlayerId.get(player.id)
    return !state?.eliminated
  })

  batch.set(playerStateRef, nextPlayerState)

  if (activePlayersAfterGuess.length === 1) {
    const winner = activePlayersAfterGuess[0]
    const winnerName = winner?.name ?? 'The remaining player'

    batch.update(roomRef, {
      status: 'finished',
      winnerId: winner?.id ?? null,
      currentTurnPlayerId: null,
    })

    batch.set(doc(collection(db, 'rooms', roomCode, 'log')), {
      message: `${playerName} was eliminated. ${winnerName} wins as the last remaining player.`,
      createdAt: serverTimestamp(),
    })

    await batch.commit()

    return {
      correct: false,
      eliminated: true,
      wrongGuesses: penalty.wrongGuesses,
      gameFinished: true,
      winnerId: winner?.id ?? null,
    }
  }

  if (activePlayersAfterGuess.length === 0) {
    batch.update(roomRef, {
      status: 'finished',
      winnerId: null,
      currentTurnPlayerId: null,
    })

    batch.set(doc(collection(db, 'rooms', roomCode, 'log')), {
      message: `${playerName} was eliminated. No active players remain.`,
      createdAt: serverTimestamp(),
    })

    await batch.commit()

    return {
      correct: false,
      eliminated: true,
      wrongGuesses: penalty.wrongGuesses,
      gameFinished: true,
      winnerId: null,
    }
  }

  const nextTurnPlayerId = getNextActiveTurnPlayerId({
    players,
    states,
    currentPlayerId: params.playerId,
    currentPlayerNextState: nextPlayerState,
  })

  batch.update(roomRef, {
    currentTurnPlayerId: nextTurnPlayerId,
  })

  batch.set(doc(collection(db, 'rooms', roomCode, 'log')), {
    message: `${playerName} guessed incorrectly. Wrong guesses: ${penalty.wrongGuesses}.`,
    createdAt: serverTimestamp(),
  })

  await batch.commit()

  return {
    correct: false,
    eliminated: penalty.eliminated,
    wrongGuesses: penalty.wrongGuesses,
    gameFinished: false,
    winnerId: null,
  }
}

export async function removePlayerFromLobby(params: {
  roomCode: string
  hostId: string
  targetPlayerId: string
}) {
  const roomCode = normalizeRoomCode(params.roomCode)
  const roomRef = doc(db, 'rooms', roomCode)
  const roomSnap = await getDoc(roomRef)

  if (!roomSnap.exists()) {
    throw new Error('Room not found.')
  }

  const room = roomSnap.data() as RoomDoc

  if (room.status !== 'lobby') {
    throw new Error('Players can only be removed before the game starts.')
  }

  if (room.hostId !== params.hostId) {
    throw new Error('Only the host can remove players.')
  }

  if (params.hostId === params.targetPlayerId) {
    throw new Error('Host cannot remove themselves. Use Leave Room instead.')
  }

  const targetPlayerRef = doc(
    db,
    'rooms',
    roomCode,
    'players',
    params.targetPlayerId,
  )
  const targetPlayerSnap = await getDoc(targetPlayerRef)

  if (!targetPlayerSnap.exists()) {
    throw new Error('Player not found.')
  }

  const targetPlayer = targetPlayerSnap.data() as Omit<LobbyPlayer, 'id'>

  const batch = writeBatch(db)

  batch.delete(targetPlayerRef)
  batch.set(doc(collection(db, 'rooms', roomCode, 'log')), {
    message: `${targetPlayer.name} was removed from the lobby by the host.`,
    createdAt: serverTimestamp(),
  })

  await batch.commit()
}

export async function resetRoomForRematch(params: {
  roomCode: string
  playerId: string
}) {
  const roomCode = normalizeRoomCode(params.roomCode)
  const roomRef = doc(db, 'rooms', roomCode)
  const roomSnap = await getDoc(roomRef)

  if (!roomSnap.exists()) {
    throw new Error('Room not found.')
  }

  const room = roomSnap.data() as RoomDoc

  if (room.hostId !== params.playerId) {
    throw new Error('Only the host can start a rematch lobby.')
  }

  if (room.status !== 'finished') {
    throw new Error('This game is not finished yet.')
  }

  const players = await getLobbyPlayers(roomCode)

  const [statesSnap, identitiesSnap, deckSnap, logSnap] = await Promise.all([
    getDocs(collection(db, 'rooms', roomCode, 'playerStates')),
    getDocs(collection(db, 'rooms', roomCode, 'identities')),
    getDocs(collection(db, 'rooms', roomCode, 'privateDeck')),
    getDocs(collection(db, 'rooms', roomCode, 'log')),
  ])

  const batch = writeBatch(db)

  for (const stateDoc of statesSnap.docs) {
    batch.delete(stateDoc.ref)
  }

  for (const identityDoc of identitiesSnap.docs) {
    batch.delete(identityDoc.ref)
  }

  for (const deckDoc of deckSnap.docs) {
    batch.delete(deckDoc.ref)
  }

  for (const logDoc of logSnap.docs) {
    batch.delete(logDoc.ref)
  }

  for (const player of players) {
    batch.update(doc(db, 'rooms', roomCode, 'players', player.id), {
      ready: player.id === room.hostId,
      isHost: player.id === room.hostId,
      wrongGuesses: 0,
      eliminated: false,
    })
  }

  batch.update(roomRef, {
    status: 'lobby',
    currentTurnPlayerId: null,
    winnerId: null,
  })

  await batch.commit()
}

export async function leaveGame(params: {
  roomCode: string
  playerId: string
}) {
  const roomCode = normalizeRoomCode(params.roomCode)
  const roomRef = doc(db, 'rooms', roomCode)
  const roomSnap = await getDoc(roomRef)

  if (!roomSnap.exists()) {
    throw new Error('Room not found.')
  }

  const room = roomSnap.data() as RoomDoc
  const players = await getLobbyPlayers(roomCode)
  const leavingPlayer = players.find((player) => player.id === params.playerId)
  const playerName = leavingPlayer?.name ?? 'A player'
  const remainingPlayers = players.filter((player) => player.id !== params.playerId)

  const batch = writeBatch(db)

  if (room.status === 'lobby') {
    batch.delete(doc(db, 'rooms', roomCode, 'players', params.playerId))

    if (remainingPlayers.length === 0) {
      batch.update(roomRef, {
        status: 'finished',
        currentTurnPlayerId: null,
        winnerId: null,
      })
    } else if (room.hostId === params.playerId) {
      const nextHost = remainingPlayers[0]

      batch.update(roomRef, {
        hostId: nextHost.id,
      })

      batch.update(doc(db, 'rooms', roomCode, 'players', nextHost.id), {
        isHost: true,
      })
    }

    batch.set(doc(collection(db, 'rooms', roomCode, 'log')), {
      message: `${playerName} left the lobby.`,
      createdAt: serverTimestamp(),
    })

    await batch.commit()

    return {
      gameFinished: remainingPlayers.length === 0,
      winnerId: null,
    }
  }

  if (room.status !== 'playing') {
    return {
      gameFinished: room.status === 'finished',
      winnerId: room.winnerId,
    }
  }

  const states = await getPlayerStates(roomCode)
  const currentState = states.find((state) => state.playerId === params.playerId)

  if (!currentState) {
    throw new Error('Player state not found.')
  }

  const nextPlayerState: PlayerGameState = {
    ...currentState,
    hand: [],
    hideYesPile: true,
    hideNoPile: true,
    eliminated: true,
  }

  const stateByPlayerId = new Map(states.map((state) => [state.playerId, state]))
  stateByPlayerId.set(params.playerId, nextPlayerState)

  const activePlayersAfterLeave = players.filter((player) => {
    const state = stateByPlayerId.get(player.id)
    return !state?.eliminated
  })

  batch.set(
    doc(db, 'rooms', roomCode, 'playerStates', params.playerId),
    nextPlayerState,
  )

  batch.update(doc(db, 'rooms', roomCode, 'players', params.playerId), {
    eliminated: true,
  })

  if (room.hostId === params.playerId && remainingPlayers.length > 0) {
    const nextHost = remainingPlayers[0]

    batch.update(roomRef, {
      hostId: nextHost.id,
    })

    batch.update(doc(db, 'rooms', roomCode, 'players', nextHost.id), {
      isHost: true,
    })
  }

  if (activePlayersAfterLeave.length === 1) {
    const winner = activePlayersAfterLeave[0]
    const winnerName = winner?.name ?? 'The remaining player'

    batch.update(roomRef, {
      status: 'finished',
      winnerId: winner?.id ?? null,
      currentTurnPlayerId: null,
    })

    batch.set(doc(collection(db, 'rooms', roomCode, 'log')), {
      message: `${playerName} left the game. ${winnerName} wins as the last remaining player.`,
      createdAt: serverTimestamp(),
    })

    await batch.commit()

    return {
      gameFinished: true,
      winnerId: winner?.id ?? null,
    }
  }

  if (activePlayersAfterLeave.length === 0) {
    batch.update(roomRef, {
      status: 'finished',
      winnerId: null,
      currentTurnPlayerId: null,
    })

    batch.set(doc(collection(db, 'rooms', roomCode, 'log')), {
      message: `${playerName} left the game. No active players remain.`,
      createdAt: serverTimestamp(),
    })

    await batch.commit()

    return {
      gameFinished: true,
      winnerId: null,
    }
  }

  if (room.currentTurnPlayerId === params.playerId) {
    const nextTurnPlayerId = getNextActiveTurnPlayerId({
      players,
      states,
      currentPlayerId: params.playerId,
      currentPlayerNextState: nextPlayerState,
    })

    batch.update(roomRef, {
      currentTurnPlayerId: nextTurnPlayerId,
    })
  }

  batch.set(doc(collection(db, 'rooms', roomCode, 'log')), {
    message: `${playerName} left the game.`,
    createdAt: serverTimestamp(),
  })

  await batch.commit()

  return {
    gameFinished: false,
    winnerId: null,
  }
}

export function listenToRoom(
  roomCode: string,
  callback: (room: RoomDoc | null) => void,
): Unsubscribe {
  return onSnapshot(doc(db, 'rooms', normalizeRoomCode(roomCode)), (snapshot) => {
    if (!snapshot.exists()) {
      callback(null)
      return
    }

    callback(snapshot.data() as RoomDoc)
  })
}

export function listenToPlayers(
  roomCode: string,
  callback: (players: LobbyPlayer[]) => void,
): Unsubscribe {
  return onSnapshot(
    collection(db, 'rooms', normalizeRoomCode(roomCode), 'players'),
    (snapshot) => {
      const players = sortPlayers(
        snapshot.docs.map((playerDoc) => ({
          id: playerDoc.id,
          ...(playerDoc.data() as Omit<LobbyPlayer, 'id'>),
        })),
      )

      callback(players)
    },
  )
}

export function listenToPlayerState(
  roomCode: string,
  playerId: string,
  callback: (state: PlayerGameState | null) => void,
): Unsubscribe {
  return onSnapshot(
    doc(db, 'rooms', normalizeRoomCode(roomCode), 'playerStates', playerId),
    (snapshot) => {
      if (!snapshot.exists()) {
        callback(null)
        return
      }

      callback(snapshot.data() as PlayerGameState)
    },
  )
}

export function listenToIdentities(
  roomCode: string,
  callback: (identities: PlayerIdentityDoc[]) => void,
): Unsubscribe {
  return onSnapshot(
    collection(db, 'rooms', normalizeRoomCode(roomCode), 'identities'),
    (snapshot) => {
      const identities = snapshot.docs.map(
        (identityDoc) => identityDoc.data() as PlayerIdentityDoc,
      )

      callback(identities)
    },
  )
}

export function listenToGameLog(
  roomCode: string,
  callback: (entries: GameLogEntry[]) => void,
): Unsubscribe {
  const logQuery = query(
    collection(db, 'rooms', normalizeRoomCode(roomCode), 'log'),
    orderBy('createdAt', 'desc'),
    limit(25),
  )

  return onSnapshot(logQuery, (snapshot) => {
    const entries = snapshot.docs.map((logDoc) => ({
      id: logDoc.id,
      ...(logDoc.data() as Omit<GameLogEntry, 'id'>),
    }))

    callback(entries)
  })
}

export async function setPlayerReady(params: {
  roomCode: string
  playerId: string
  ready: boolean
}) {
  await updateDoc(
    doc(db, 'rooms', normalizeRoomCode(params.roomCode), 'players', params.playerId),
    {
      ready: params.ready,
    },
  )
}
