import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
  type Unsubscribe,
} from 'firebase/firestore'
import { applyWrongGuessPenalty, isCorrectGuess } from '../game/guess'
import { appendPublicGuess, createPublicGuess } from '../game/publicGuess'
import { isCardSetSize, normalizeCardSetSize } from '../game/deck'
import { appendPublicReveal, createPublicReveal } from '../game/publicReveal'
import { getClueResult } from '../game/rules'
import { createInitialGameState } from '../game/setup'
import type { StartingCluesMode } from '../game/setup'
import type { Card, CardSetSize, Guess } from '../types/card'
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

function isStartingCluesMode(value: unknown): value is StartingCluesMode {
  return value === 'automatic' || value === 'playerChoice'
}

async function getEditableLobbyRoom(params: {
  roomCode: string
  hostId: string
  optionName: string
}) {
  const roomCode = normalizeRoomCode(params.roomCode)
  const roomRef = doc(db, 'rooms', roomCode)
  const roomSnap = await getDoc(roomRef)

  if (!roomSnap.exists()) {
    throw new Error('Room not found.')
  }

  const room = roomSnap.data() as RoomDoc

  if (room.hostId !== params.hostId) {
    throw new Error(`Only the host can change ${params.optionName}.`)
  }

  if (room.status !== 'lobby') {
    throw new Error(`${params.optionName} can only be changed in the lobby.`)
  }

  return { roomRef, room }
}

function applyRevealResult(params: {
  playerState: PlayerGameState
  revealedCard: Card
  deckState: PrivateDeckDoc
  result: 'YES' | 'NO'
}) {
  const handWithoutCard = params.playerState.hand.filter(
    (card) => card.id !== params.revealedCard.id,
  )
  const { drawnCard, remainingDeck } = drawOne(params.deckState.deck)
  const nextHand = drawnCard
    ? [...handWithoutCard, drawnCard]
    : handWithoutCard

  return {
    nextPlayerState: {
      ...params.playerState,
      hand: nextHand,
      yesPile:
        params.result === 'YES'
          ? [...params.playerState.yesPile, params.revealedCard]
          : params.playerState.yesPile,
      noPile:
        params.result === 'NO'
          ? [...params.playerState.noPile, params.revealedCard]
          : params.playerState.noPile,
    },
    nextDeckState: {
      deck: remainingDeck,
      discardPile: params.deckState.discardPile,
    },
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
      pendingReveal: null,
      lastReveal: null,
      publicReveals: [],
      publicGuesses: [],
      turnNumber: 0,
      manualResponses: false,
      cardSetSize: 8,
      startingCluesMode: 'automatic',
      currentTurnPlayerId: null,
      winnerId: null,
      playerCount: 1,
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
  const playerRef = doc(db, 'rooms', roomCode, 'players', params.playerId)

  const fallbackPlayers = await getLobbyPlayers(roomCode).catch(() => null)

  await runTransaction(db, async (transaction) => {
    const [roomSnap, playerSnap] = await Promise.all([
      transaction.get(roomRef),
      transaction.get(playerRef),
    ])

    if (!roomSnap.exists()) {
      throw new Error('Room not found.')
    }

    const room = roomSnap.data() as RoomDoc

    if (room.status !== 'lobby') {
      throw new Error('This game has already started.')
    }

    const alreadyJoined = playerSnap.exists()
    const currentPlayerCount =
      typeof room.playerCount === 'number'
        ? room.playerCount
        : fallbackPlayers?.length ?? (alreadyJoined ? 1 : 0)

    if (!alreadyJoined && currentPlayerCount >= MAX_PLAYERS) {
      throw new Error('This room is full.')
    }

    transaction.set(
      playerRef,
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

    transaction.update(roomRef, {
      playerCount: alreadyJoined ? currentPlayerCount : currentPlayerCount + 1,
    })
  })

  return roomCode
}

export async function setManualResponses(params: {
  roomCode: string
  enabled: boolean
}) {
  const roomCode = normalizeRoomCode(params.roomCode)

  await updateDoc(doc(db, 'rooms', roomCode), {
    manualResponses: params.enabled,
    pendingReveal: null,
  })
}

export async function setRoomCardSetSize(params: {
  roomCode: string
  hostId: string
  cardSetSize: CardSetSize
}) {
  if (!isCardSetSize(params.cardSetSize)) {
    throw new Error('Choose 4x4x4, 6x6x6, or 8x8x8 cards.')
  }

  const { roomRef } = await getEditableLobbyRoom({
    roomCode: params.roomCode,
    hostId: params.hostId,
    optionName: 'card options',
  })

  await updateDoc(roomRef, {
    cardSetSize: params.cardSetSize,
  })
}

export async function setRoomStartingCluesMode(params: {
  roomCode: string
  hostId: string
  startingCluesMode: StartingCluesMode
}) {
  if (!isStartingCluesMode(params.startingCluesMode)) {
    throw new Error('Choose automatic or player-chosen starting clues.')
  }

  const { roomRef } = await getEditableLobbyRoom({
    roomCode: params.roomCode,
    hostId: params.hostId,
    optionName: 'starting clue options',
  })

  await updateDoc(roomRef, {
    startingCluesMode: params.startingCluesMode,
  })
}

export async function startGame(params: {
  roomCode: string
  hostId: string
}) {
  const roomCode = normalizeRoomCode(params.roomCode)
  const roomRef = doc(db, 'rooms', roomCode)
  const players = await getLobbyPlayers(roomCode)
  const playerRefs = players.map((player) =>
    doc(db, 'rooms', roomCode, 'players', player.id),
  )

  await runTransaction(db, async (transaction) => {
    const roomSnap = await transaction.get(roomRef)

    if (!roomSnap.exists()) {
      throw new Error('Room not found.')
    }

    const playerSnaps = await Promise.all(
      playerRefs.map((playerRef) => transaction.get(playerRef)),
    )

    const room = roomSnap.data() as RoomDoc
    const currentPlayerCount = room.playerCount ?? players.length

    if (room.hostId !== params.hostId) {
      throw new Error('Only the host can start the game.')
    }

    if (room.status !== 'lobby') {
      throw new Error('This game has already started.')
    }

    if (currentPlayerCount !== players.length) {
      throw new Error('Players changed while starting the game. Try again.')
    }

    const transactionPlayers = sortPlayers(
      playerSnaps.map((playerSnap, index) => {
        if (!playerSnap.exists()) {
          throw new Error('Players changed while starting the game. Try again.')
        }

        return {
          id: players[index].id,
          ...(playerSnap.data() as Omit<LobbyPlayer, 'id'>),
        }
      }),
    )

    if (transactionPlayers.length < 2 || transactionPlayers.length > 4) {
      throw new Error('Game requires 2–4 players.')
    }

    if (!transactionPlayers.every((player) => player.ready)) {
      throw new Error('Every player must be ready.')
    }

    const cardSetSize = normalizeCardSetSize(room.cardSetSize)
    const startingCluesMode = isStartingCluesMode(room.startingCluesMode)
      ? room.startingCluesMode
      : 'automatic'
    const initialGameState = createInitialGameState(
      transactionPlayers.map((player) => player.id),
      Math.random,
      cardSetSize,
      { startingClues: startingCluesMode },
    )

    for (const playerState of initialGameState.players) {
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

      transaction.set(
        doc(db, 'rooms', roomCode, 'playerStates', playerState.playerId),
        state,
      )
      transaction.set(
        doc(db, 'rooms', roomCode, 'identities', playerState.playerId),
        identity,
      )
      transaction.update(doc(db, 'rooms', roomCode, 'players', playerState.playerId), {
        wrongGuesses: 0,
        eliminated: false,
      })
    }

    transaction.set(doc(db, 'rooms', roomCode, 'privateDeck', 'state'), {
      deck: initialGameState.deck,
      discardPile: initialGameState.discardPile,
    })

    transaction.set(doc(collection(db, 'rooms', roomCode, 'log')), {
      message: 'Game started. Cards were dealt.',
      createdAt: serverTimestamp(),
    })

    if (startingCluesMode === 'playerChoice') {
      transaction.set(doc(collection(db, 'rooms', roomCode, 'log')), {
        message:
          'Setup clues started. Each player must give one YES clue and one NO clue to the next player.',
        createdAt: serverTimestamp(),
      })
    }

    transaction.update(roomRef, {
      status: startingCluesMode === 'playerChoice' ? 'setupClues' : 'playing',
      lastReveal: null,
      publicReveals: [],
      publicGuesses: [],
      turnNumber: startingCluesMode === 'playerChoice' ? 0 : 1,
      currentTurnPlayerId:
        startingCluesMode === 'playerChoice'
          ? null
          : initialGameState.currentTurnPlayerId,
    })
  })
}


export async function submitInitialClues(params: {
  roomCode: string
  giverId: string
  yesCardId: string
  noCardId: string
}) {
  const roomCode = normalizeRoomCode(params.roomCode)
  const roomRef = doc(db, 'rooms', roomCode)

  if (params.yesCardId === params.noCardId) {
    throw new Error('Pick two different cards.')
  }

  const players = await getLobbyPlayers(roomCode)
  const sortedPlayers = sortPlayers(players)

  if (sortedPlayers.length < 2) {
    throw new Error('Need at least two players.')
  }

  const giverIndex = sortedPlayers.findIndex(
    (player) => player.id === params.giverId,
  )

  if (giverIndex === -1) {
    throw new Error('You are not in this room.')
  }

  const receiver = sortedPlayers[(giverIndex + 1) % sortedPlayers.length]
  const giverStateRef = doc(db, 'rooms', roomCode, 'playerStates', params.giverId)
  const receiverStateRef = doc(db, 'rooms', roomCode, 'playerStates', receiver.id)
  const receiverIdentityRef = doc(db, 'rooms', roomCode, 'identities', receiver.id)
  const deckRef = doc(db, 'rooms', roomCode, 'privateDeck', 'state')
  const assignmentRef = doc(db, 'rooms', roomCode, 'initialClues', params.giverId)
  const assignmentRefs = sortedPlayers.map((player) =>
    doc(db, 'rooms', roomCode, 'initialClues', player.id),
  )

  await runTransaction(db, async (transaction) => {
    const [
      roomSnap,
      giverStateSnap,
      receiverStateSnap,
      receiverIdentitySnap,
      deckSnap,
      assignmentSnap,
      ...assignmentSnaps
    ] = await Promise.all([
      transaction.get(roomRef),
      transaction.get(giverStateRef),
      transaction.get(receiverStateRef),
      transaction.get(receiverIdentityRef),
      transaction.get(deckRef),
      transaction.get(assignmentRef),
      ...assignmentRefs.map((ref) => transaction.get(ref)),
    ])

    if (!roomSnap.exists()) {
      throw new Error('Room not found.')
    }

    const room = roomSnap.data() as RoomDoc

    if (room.status !== 'setupClues') {
      throw new Error('Starting clues are not being selected right now.')
    }

    if (assignmentSnap.exists()) {
      throw new Error('You already picked starting clues.')
    }

    if (!giverStateSnap.exists() || !receiverStateSnap.exists()) {
      throw new Error('Player state not found.')
    }

    if (!receiverIdentitySnap.exists()) {
      throw new Error('Target identity not found.')
    }

    if (!deckSnap.exists()) {
      throw new Error('Deck not found.')
    }

    const giverState = giverStateSnap.data() as PlayerGameState
    const receiverState = receiverStateSnap.data() as PlayerGameState
    const receiverIdentity = receiverIdentitySnap.data() as PlayerIdentityDoc
    const deckState = deckSnap.data() as PrivateDeckDoc

    const yesCard = giverState.hand.find((card) => card.id === params.yesCardId)
    const noCard = giverState.hand.find((card) => card.id === params.noCardId)

    if (!yesCard || !noCard) {
      throw new Error('Both starting clues must come from your hand.')
    }

    const yesResult = getClueResult(yesCard, receiverIdentity.hiddenIdentity)
    const noResult = getClueResult(noCard, receiverIdentity.hiddenIdentity)

    if (yesResult !== 'YES') {
      throw new Error('The YES clue does not match that player’s hidden card.')
    }

    if (noResult !== 'NO') {
      throw new Error('The NO clue still matches that player’s hidden card.')
    }

    let remainingDeck = [...deckState.deck]
    let nextHand = giverState.hand.filter(
      (card) => card.id !== yesCard.id && card.id !== noCard.id,
    )

    for (let index = 0; index < 2; index += 1) {
      const draw = drawOne(remainingDeck)
      remainingDeck = draw.remainingDeck

      if (draw.drawnCard) {
        nextHand = [...nextHand, draw.drawnCard]
      }
    }

    const nextGiverState: PlayerGameState = {
      ...giverState,
      hand: nextHand,
    }

    const nextReceiverState: PlayerGameState = {
      ...receiverState,
      yesPile: [...receiverState.yesPile, yesCard],
      noPile: [...receiverState.noPile, noCard],
    }

    const completedGiverIds = new Set(
      assignmentSnaps
        .filter((assignmentDoc) => assignmentDoc.exists())
        .map((assignmentDoc) => assignmentDoc.id),
    )
    completedGiverIds.add(params.giverId)

    const allSetupCluesDone = sortedPlayers.every((player) =>
      completedGiverIds.has(player.id),
    )

    const giverName =
      sortedPlayers.find((player) => player.id === params.giverId)?.name ??
      'A player'
    const receiverName = receiver.name

    transaction.set(giverStateRef, nextGiverState)
    transaction.set(receiverStateRef, nextReceiverState)
    transaction.set(deckRef, {
      deck: remainingDeck,
      discardPile: deckState.discardPile,
    })
    transaction.set(assignmentRef, {
      giverId: params.giverId,
      receiverId: receiver.id,
      createdAt: serverTimestamp(),
    })
    transaction.set(doc(collection(db, 'rooms', roomCode, 'log')), {
      message: `${giverName} picked starting clues for ${receiverName}.`,
      createdAt: serverTimestamp(),
    })

    if (allSetupCluesDone) {
      transaction.update(roomRef, {
        status: 'playing',
        currentTurnPlayerId: sortedPlayers[0].id,
      })
      transaction.set(doc(collection(db, 'rooms', roomCode, 'log')), {
        message: 'All starting clues are ready. The game begins.',
        createdAt: serverTimestamp(),
      })
    }
  })
}

export async function revealCard(params: {
  roomCode: string
  playerId: string
  cardId: string
}) {
  const roomCode = normalizeRoomCode(params.roomCode)
  const roomRef = doc(db, 'rooms', roomCode)
  const playerStateRef = doc(
    db,
    'rooms',
    roomCode,
    'playerStates',
    params.playerId,
  )

  const roomSnap = await getDoc(roomRef)

  if (!roomSnap.exists()) {
    throw new Error('Room not found.')
  }

  const initialRoom = roomSnap.data() as RoomDoc

  if (!initialRoom.manualResponses) {
    return revealCardAutomatic(params)
  }

  const players = sortPlayers(await getLobbyPlayers(roomCode))

  const result = await runTransaction(db, async (transaction) => {
    const [transactionRoomSnap, playerStateSnap] = await Promise.all([
      transaction.get(roomRef),
      transaction.get(playerStateRef),
    ])

    if (!transactionRoomSnap.exists()) {
      throw new Error('Room not found.')
    }

    const room = transactionRoomSnap.data() as RoomDoc

    if (!room.manualResponses) {
      throw new Error('Manual responses are not enabled for this room.')
    }

    if (room.status !== 'playing') {
      throw new Error('You can only reveal cards during regular play.')
    }

    if (room.currentTurnPlayerId !== params.playerId) {
      throw new Error('It is not your turn.')
    }

    if (room.pendingReveal) {
      throw new Error('A revealed card is already waiting for an answer.')
    }

    if (!playerStateSnap.exists()) {
      throw new Error('Player state not found.')
    }

    const playerState = playerStateSnap.data() as PlayerGameState

    if (playerState.eliminated) {
      throw new Error('You are eliminated.')
    }

    const revealedCard = playerState.hand.find((card) => card.id === params.cardId)

    if (!revealedCard) {
      throw new Error('Card not found in your hand.')
    }

    const activePlayers = players.filter((player) => !(player.eliminated ?? false))
    const currentIndex = activePlayers.findIndex(
      (player) => player.id === params.playerId,
    )

    if (currentIndex === -1 || activePlayers.length < 2) {
      throw new Error('No other active player can answer.')
    }

    const responder = activePlayers[(currentIndex + 1) % activePlayers.length]
    const revealer = activePlayers[currentIndex]

    transaction.update(roomRef, {
      pendingReveal: {
        playerId: params.playerId,
        responderId: responder.id,
        card: revealedCard,
      },
    })

    transaction.set(doc(collection(db, 'rooms', roomCode, 'log')), {
      message: `${revealer.name} revealed a card. Waiting for ${responder.name} to answer YES or NO.`,
      createdAt: serverTimestamp(),
    })

    return 'PENDING' as const
  })

  return result
}

async function revealCardAutomatic(params: {
  roomCode: string
  playerId: string
  cardId: string
}) {
  const roomCode = normalizeRoomCode(params.roomCode)
  const roomRef = doc(db, 'rooms', roomCode)
  const playerStateRef = doc(db, 'rooms', roomCode, 'playerStates', params.playerId)
  const identityRef = doc(db, 'rooms', roomCode, 'identities', params.playerId)
  const deckRef = doc(db, 'rooms', roomCode, 'privateDeck', 'state')

  const players = await getLobbyPlayers(roomCode)
  const states = await getPlayerStates(roomCode)

  const result = await runTransaction(db, async (transaction) => {
    const [roomSnap, playerStateSnap, identitySnap, deckSnap] = await Promise.all([
      transaction.get(roomRef),
      transaction.get(playerStateRef),
      transaction.get(identityRef),
      transaction.get(deckRef),
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

    const revealResult = getClueResult(revealedCard, identity.hiddenIdentity)
    const { nextPlayerState, nextDeckState } = applyRevealResult({
      playerState,
      revealedCard,
      deckState,
      result: revealResult,
    })

    const nextTurnPlayerId = getNextActiveTurnPlayerId({
      players,
      states,
      currentPlayerId: params.playerId,
      currentPlayerNextState: nextPlayerState,
    })
    const playerName =
      players.find((player) => player.id === params.playerId)?.name ?? 'A player'
    const publicReveal = createPublicReveal({
      playerId: params.playerId,
      playerName,
      card: revealedCard,
      result: revealResult,
    })

    transaction.set(playerStateRef, nextPlayerState)
    transaction.set(deckRef, nextDeckState)
    transaction.update(roomRef, {
      currentTurnPlayerId: nextTurnPlayerId,
      lastReveal: publicReveal,
      publicReveals: appendPublicReveal(room.publicReveals, publicReveal),
    })
    transaction.set(doc(collection(db, 'rooms', roomCode, 'log')), {
      message: `${playerName} revealed a card. Result: ${revealResult}.`,
      createdAt: serverTimestamp(),
    })

    return revealResult
  })

  return result
}

export async function submitRevealResponse(params: {
  roomCode: string
  responderId: string
  result: 'YES' | 'NO'
}) {
  const roomCode = normalizeRoomCode(params.roomCode)
  const roomRef = doc(db, 'rooms', roomCode)
  const deckRef = doc(db, 'rooms', roomCode, 'privateDeck', 'state')
  const players = sortPlayers(await getLobbyPlayers(roomCode))
  const states = await getPlayerStates(roomCode)

  const result = await runTransaction(db, async (transaction) => {
    const [roomSnap, deckSnap] = await Promise.all([
      transaction.get(roomRef),
      transaction.get(deckRef),
    ])

    if (!roomSnap.exists()) {
      throw new Error('Room not found.')
    }

    const room = roomSnap.data() as RoomDoc

    if (!room.manualResponses) {
      throw new Error('Manual responses are not enabled for this room.')
    }

    if (room.status !== 'playing') {
      throw new Error('You can only answer during regular play.')
    }

    if (!room.pendingReveal) {
      throw new Error('No revealed card is waiting for an answer.')
    }

    if (room.pendingReveal.responderId !== params.responderId) {
      throw new Error('You are not the player answering this card.')
    }

    if (!deckSnap.exists()) {
      throw new Error('Deck not found.')
    }

    const revealedCard = room.pendingReveal.card
    const revealerId = room.pendingReveal.playerId
    const revealerStateRef = doc(
      db,
      'rooms',
      roomCode,
      'playerStates',
      revealerId,
    )
    const revealerStateSnap = await transaction.get(revealerStateRef)

    if (!revealerStateSnap.exists()) {
      throw new Error('Revealing player state not found.')
    }

    const revealerState = revealerStateSnap.data() as PlayerGameState
    const deckState = deckSnap.data() as PrivateDeckDoc

    const cardStillInHand = revealerState.hand.some(
      (card) => card.id === revealedCard.id,
    )

    if (!cardStillInHand) {
      throw new Error('The revealed card is no longer in that player’s hand.')
    }

    const { nextPlayerState: nextRevealerState, nextDeckState } =
      applyRevealResult({
        playerState: revealerState,
        revealedCard,
        deckState,
        result: params.result,
      })

    const nextTurnPlayerId = getNextActiveTurnPlayerId({
      players,
      states,
      currentPlayerId: revealerId,
      currentPlayerNextState: nextRevealerState,
    })

    const responderName =
      players.find((player) => player.id === params.responderId)?.name ??
      'A player'
    const revealerName =
      players.find((player) => player.id === revealerId)?.name ?? 'a player'
    const publicReveal = createPublicReveal({
      playerId: revealerId,
      playerName: revealerName,
      card: revealedCard,
      result: params.result,
    })

    transaction.set(revealerStateRef, nextRevealerState)
    transaction.set(deckRef, nextDeckState)
    transaction.update(roomRef, {
      pendingReveal: null,
      currentTurnPlayerId: nextTurnPlayerId,
      lastReveal: publicReveal,
      publicReveals: appendPublicReveal(room.publicReveals, publicReveal),
    })

    transaction.set(doc(collection(db, 'rooms', roomCode, 'log')), {
      message: `${responderName} answered ${params.result} for ${revealerName}'s revealed card.`,
      createdAt: serverTimestamp(),
    })

    return params.result
  })

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
  const playerRef = doc(db, 'rooms', roomCode, 'players', params.playerId)
  const identityRef = doc(db, 'rooms', roomCode, 'identities', params.playerId)

  const players = await getLobbyPlayers(roomCode)
  const states = await getPlayerStates(roomCode)

  return runTransaction(db, async (transaction) => {
    const [roomSnap, playerStateSnap, identitySnap] = await Promise.all([
      transaction.get(roomRef),
      transaction.get(playerStateRef),
      transaction.get(identityRef),
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
    const nextTurnNumber = (room.turnNumber ?? 0) + 1
    const publicGuess = createPublicGuess({
      playerId: params.playerId,
      playerName,
      guess: params.guess,
      correct,
      turnNumber: nextTurnNumber,
    })

    if (correct) {
      transaction.update(roomRef, {
        status: 'finished',
        winnerId: params.playerId,
        currentTurnPlayerId: null,
        publicGuesses: appendPublicGuess(room.publicGuesses, publicGuess),
        turnNumber: nextTurnNumber,
      })

      transaction.set(doc(collection(db, 'rooms', roomCode, 'log')), {
        message: `${playerName} guessed correctly and won the game.`,
        createdAt: serverTimestamp(),
      })

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

    transaction.set(playerStateRef, nextPlayerState)
    transaction.update(playerRef, {
      wrongGuesses: penalty.wrongGuesses,
      eliminated: penalty.eliminated,
    })

    if (activePlayersAfterGuess.length === 1) {
      const winner = activePlayersAfterGuess[0]
      const winnerName = winner?.name ?? 'The remaining player'

      transaction.update(roomRef, {
        status: 'finished',
        winnerId: winner?.id ?? null,
        currentTurnPlayerId: null,
        publicGuesses: appendPublicGuess(room.publicGuesses, publicGuess),
        turnNumber: nextTurnNumber,
      })

      transaction.set(doc(collection(db, 'rooms', roomCode, 'log')), {
        message: `${playerName} was eliminated. ${winnerName} wins as the last remaining player.`,
        createdAt: serverTimestamp(),
      })

      return {
        correct: false,
        eliminated: true,
        wrongGuesses: penalty.wrongGuesses,
        gameFinished: true,
        winnerId: winner?.id ?? null,
      }
    }

    if (activePlayersAfterGuess.length === 0) {
      transaction.update(roomRef, {
        status: 'finished',
        winnerId: null,
        currentTurnPlayerId: null,
        publicGuesses: appendPublicGuess(room.publicGuesses, publicGuess),
        turnNumber: nextTurnNumber,
      })

      transaction.set(doc(collection(db, 'rooms', roomCode, 'log')), {
        message: `${playerName} was eliminated. No active players remain.`,
        createdAt: serverTimestamp(),
      })

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

    transaction.update(roomRef, {
      currentTurnPlayerId: nextTurnPlayerId,
      publicGuesses: appendPublicGuess(room.publicGuesses, publicGuess),
      turnNumber: nextTurnNumber,
    })

    transaction.set(doc(collection(db, 'rooms', roomCode, 'log')), {
      message: `${playerName} guessed incorrectly. Wrong guesses: ${penalty.wrongGuesses}.`,
      createdAt: serverTimestamp(),
    })

    return {
      correct: false,
      eliminated: penalty.eliminated,
      wrongGuesses: penalty.wrongGuesses,
      gameFinished: false,
      winnerId: null,
    }
  })
}

export async function removePlayerFromLobby(params: {
  roomCode: string
  hostId: string
  targetPlayerId: string
}) {
  const roomCode = normalizeRoomCode(params.roomCode)
  const roomRef = doc(db, 'rooms', roomCode)
  const targetPlayerRef = doc(
    db,
    'rooms',
    roomCode,
    'players',
    params.targetPlayerId,
  )
  await runTransaction(db, async (transaction) => {
    const [roomSnap, targetPlayerSnap] = await Promise.all([
      transaction.get(roomRef),
      transaction.get(targetPlayerRef),
    ])

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

    if (!targetPlayerSnap.exists()) {
      throw new Error('Player not found.')
    }

    const targetPlayer = targetPlayerSnap.data() as Omit<LobbyPlayer, 'id'>
    const nextPlayerCount = Math.max((room.playerCount ?? 1) - 1, 0)

    transaction.delete(targetPlayerRef)
    transaction.update(roomRef, {
      playerCount: nextPlayerCount,
    })
    transaction.set(doc(collection(db, 'rooms', roomCode, 'log')), {
      message: `${targetPlayer.name} was removed from the lobby by the host.`,
      createdAt: serverTimestamp(),
    })
  })
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

  const [statesSnap, identitiesSnap, deckSnap, logSnap, initialCluesSnap] = await Promise.all([
    getDocs(collection(db, 'rooms', roomCode, 'playerStates')),
    getDocs(collection(db, 'rooms', roomCode, 'identities')),
    getDocs(collection(db, 'rooms', roomCode, 'privateDeck')),
    getDocs(collection(db, 'rooms', roomCode, 'log')),
    getDocs(collection(db, 'rooms', roomCode, 'initialClues')),
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

  for (const initialClueDoc of initialCluesSnap.docs) {
    batch.delete(initialClueDoc.ref)
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
  const playerRef = doc(db, 'rooms', roomCode, 'players', params.playerId)
  const playerStateRef = doc(db, 'rooms', roomCode, 'playerStates', params.playerId)
  const players = await getLobbyPlayers(roomCode)
  const states = await getPlayerStates(roomCode)
  const leavingPlayer = players.find((player) => player.id === params.playerId)
  const playerName = leavingPlayer?.name ?? 'A player'
  const remainingPlayers = players.filter((player) => player.id !== params.playerId)

  return runTransaction(db, async (transaction) => {
    const roomSnap = await transaction.get(roomRef)

    if (!roomSnap.exists()) {
      throw new Error('Room not found.')
    }

    const room = roomSnap.data() as RoomDoc

    if (room.status === 'lobby') {
      transaction.delete(playerRef)

      if (remainingPlayers.length === 0) {
        transaction.update(roomRef, {
          status: 'finished',
          currentTurnPlayerId: null,
          winnerId: null,
          playerCount: 0,
        })
      } else if (room.hostId === params.playerId) {
        const nextHost = remainingPlayers[0]

        transaction.update(roomRef, {
          hostId: nextHost.id,
          playerCount: remainingPlayers.length,
        })

        transaction.update(doc(db, 'rooms', roomCode, 'players', nextHost.id), {
          isHost: true,
        })
      } else {
        transaction.update(roomRef, {
          playerCount: remainingPlayers.length,
        })
      }

      transaction.set(doc(collection(db, 'rooms', roomCode, 'log')), {
        message: `${playerName} left the lobby.`,
        createdAt: serverTimestamp(),
      })

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

    const currentStateSnap = await transaction.get(playerStateRef)

    if (!currentStateSnap.exists()) {
      throw new Error('Player state not found.')
    }

    const currentState = currentStateSnap.data() as PlayerGameState

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

    transaction.set(playerStateRef, nextPlayerState)

    transaction.update(playerRef, {
      eliminated: true,
    })

    if (room.hostId === params.playerId && remainingPlayers.length > 0) {
      const nextHost = remainingPlayers[0]

      transaction.update(roomRef, {
        hostId: nextHost.id,
      })

      transaction.update(doc(db, 'rooms', roomCode, 'players', nextHost.id), {
        isHost: true,
      })
    }

    if (activePlayersAfterLeave.length === 1) {
      const winner = activePlayersAfterLeave[0]
      const winnerName = winner?.name ?? 'The remaining player'

      transaction.update(roomRef, {
        status: 'finished',
        winnerId: winner?.id ?? null,
        currentTurnPlayerId: null,
      })

      transaction.set(doc(collection(db, 'rooms', roomCode, 'log')), {
        message: `${playerName} left the game. ${winnerName} wins as the last remaining player.`,
        createdAt: serverTimestamp(),
      })

      return {
        gameFinished: true,
        winnerId: winner?.id ?? null,
      }
    }

    if (activePlayersAfterLeave.length === 0) {
      transaction.update(roomRef, {
        status: 'finished',
        winnerId: null,
        currentTurnPlayerId: null,
      })

      transaction.set(doc(collection(db, 'rooms', roomCode, 'log')), {
        message: `${playerName} left the game. No active players remain.`,
        createdAt: serverTimestamp(),
      })

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

      transaction.update(roomRef, {
        currentTurnPlayerId: nextTurnPlayerId,
      })
    }

    transaction.set(doc(collection(db, 'rooms', roomCode, 'log')), {
      message: `${playerName} left the game.`,
      createdAt: serverTimestamp(),
    })

    return {
      gameFinished: false,
      winnerId: null,
    }
  })
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
