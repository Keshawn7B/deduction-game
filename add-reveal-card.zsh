#!/usr/bin/env zsh
set -e

cd ~/deduction-game

cat > src/firebase/rooms.ts <<'EOF'
import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
  type Unsubscribe,
} from 'firebase/firestore'
import { createInitialGameState } from '../game/setup'
import { getClueResult } from '../game/rules'
import type { Card } from '../types/card'
import type {
  PlayerGameState,
  PlayerIdentityDoc,
  PrivateDeckDoc,
} from '../types/game'
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

function getNextTurnPlayerId(players: LobbyPlayer[], currentPlayerId: string): string {
  const sortedPlayers = sortPlayers(players)
  const currentIndex = sortedPlayers.findIndex(
    (player) => player.id === currentPlayerId,
  )

  if (currentIndex === -1) {
    return sortedPlayers[0]?.id ?? currentPlayerId
  }

  const nextIndex = (currentIndex + 1) % sortedPlayers.length
  return sortedPlayers[nextIndex]?.id ?? currentPlayerId
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

  const playersSnap = await getDocs(collection(db, 'rooms', roomCode, 'players'))

  const players = sortPlayers(
    playersSnap.docs.map((playerDoc) => ({
      id: playerDoc.id,
      ...(playerDoc.data() as Omit<LobbyPlayer, 'id'>),
    })),
  )

  if (players.length < 2 || players.length > 4) {
    throw new Error('Game requires 2–4 players.')
  }

  if (!players.every((player) => player.ready)) {
    throw new Error('Every player must be ready.')
  }

  const initialGameState = createInitialGameState(
    players.map((player) => player.id),
  )

  const batch = writeBatch(db)

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

    batch.set(
      doc(db, 'rooms', roomCode, 'playerStates', playerState.playerId),
      state,
    )

    batch.set(
      doc(db, 'rooms', roomCode, 'identities', playerState.playerId),
      identity,
    )
  }

  batch.set(doc(db, 'rooms', roomCode, 'privateDeck', 'state'), {
    deck: initialGameState.deck,
    discardPile: initialGameState.discardPile,
  })

  batch.set(doc(collection(db, 'rooms', roomCode, 'log')), {
    message: 'Game started. Cards were dealt.',
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

  const [roomSnap, playerStateSnap, identitySnap, deckSnap, playersSnap] =
    await Promise.all([
      getDoc(roomRef),
      getDoc(playerStateRef),
      getDoc(identityRef),
      getDoc(deckRef),
      getDocs(collection(db, 'rooms', roomCode, 'players')),
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
  const players = playersSnap.docs.map((playerDoc) => ({
    id: playerDoc.id,
    ...(playerDoc.data() as Omit<LobbyPlayer, 'id'>),
  }))

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

  const nextTurnPlayerId = getNextTurnPlayerId(players, params.playerId)
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
EOF

cat > src/pages/GamePage.tsx <<'EOF'
import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { CardView } from '../components/game/CardView'
import { Button } from '../components/ui/Button'
import { useAuth } from '../context/AuthContext'
import {
  listenToIdentities,
  listenToPlayers,
  listenToPlayerState,
  listenToRoom,
  revealCard,
} from '../firebase/rooms'
import type { PlayerGameState, PlayerIdentityDoc } from '../types/game'
import type { LobbyPlayer, RoomDoc } from '../types/room'

export function GamePage() {
  const { roomCode = '' } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()

  const [room, setRoom] = useState<RoomDoc | null>(null)
  const [players, setPlayers] = useState<LobbyPlayer[]>([])
  const [playerState, setPlayerState] = useState<PlayerGameState | null>(null)
  const [identities, setIdentities] = useState<PlayerIdentityDoc[]>([])
  const [selectedCardId, setSelectedCardId] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    if (!roomCode || !user) return

    const unsubscribeRoom = listenToRoom(roomCode, setRoom)
    const unsubscribePlayers = listenToPlayers(roomCode, setPlayers)
    const unsubscribePlayerState = listenToPlayerState(
      roomCode,
      user.uid,
      setPlayerState,
    )
    const unsubscribeIdentities = listenToIdentities(roomCode, setIdentities)

    return () => {
      unsubscribeRoom()
      unsubscribePlayers()
      unsubscribePlayerState()
      unsubscribeIdentities()
    }
  }, [roomCode, user])

  useEffect(() => {
    if (room?.status === 'lobby') {
      navigate(`/lobby/${roomCode}`)
    }

    if (room?.status === 'finished') {
      navigate(`/winner/${roomCode}`)
    }
  }, [navigate, room?.status, roomCode])

  useEffect(() => {
    setSelectedCardId('')
  }, [room?.currentTurnPlayerId])

  const isYourTurn = room?.currentTurnPlayerId === user?.uid

  const currentTurnName = useMemo(() => {
    const currentPlayer = players.find(
      (player) => player.id === room?.currentTurnPlayerId,
    )

    return currentPlayer?.name ?? 'Unknown'
  }, [players, room?.currentTurnPlayerId])

  const visibleIdentities = useMemo(
    () => identities.filter((identity) => identity.playerId !== user?.uid),
    [identities, user?.uid],
  )

  const playerNameById = useMemo(() => {
    return new Map(players.map((player) => [player.id, player.name]))
  }, [players])

  async function handleRevealCard() {
    if (!user || !selectedCardId) return

    setBusy(true)
    setError('')
    setMessage('')

    try {
      const result = await revealCard({
        roomCode,
        playerId: user.uid,
        cardId: selectedCardId,
      })

      setMessage(`Card revealed. Result: ${result}.`)
      setSelectedCardId('')
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Could not reveal card.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="mx-auto min-h-screen max-w-6xl px-4 py-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-black">Game</h1>
          <p className="text-slate-300">
            Room Code:{' '}
            <span className="font-mono font-black text-cyan-300">{roomCode}</span>
          </p>
          <p className="mt-1 text-sm text-slate-400">
            Current Turn: {currentTurnName}
          </p>
        </div>

        <Link to={`/game/${roomCode}/guess`}>
          <Button>Make Guess</Button>
        </Link>
      </div>

      <div className="mt-4 rounded-2xl border border-slate-800 bg-slate-900 p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-bold">
              {isYourTurn ? 'Your turn' : `Waiting for ${currentTurnName}`}
            </p>
            <p className="text-sm text-slate-400">
              Select a card from your hand, then reveal it.
            </p>
          </div>

          <Button
            onClick={handleRevealCard}
            disabled={!isYourTurn || !selectedCardId || busy}
          >
            {busy ? 'Revealing...' : 'Reveal Selected Card'}
          </Button>
        </div>

        {message ? (
          <p className="mt-3 rounded-xl border border-emerald-500/40 bg-emerald-950/30 px-4 py-3 text-sm text-emerald-200">
            {message}
          </p>
        ) : null}

        {error ? (
          <p className="mt-3 rounded-xl border border-rose-500/50 bg-rose-950/40 px-4 py-3 text-sm text-rose-200">
            {error}
          </p>
        ) : null}
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-[2fr_1fr]">
        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
          <h2 className="font-bold">Your Hand</h2>

          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {playerState?.hand.map((card) => {
              const selected = selectedCardId === card.id

              return (
                <button
                  key={card.id}
                  type="button"
                  onClick={() => setSelectedCardId(card.id)}
                  disabled={!isYourTurn || busy}
                  className={`rounded-2xl text-left transition ${
                    selected
                      ? 'ring-2 ring-cyan-300'
                      : 'ring-1 ring-transparent'
                  } disabled:cursor-not-allowed disabled:opacity-70`}
                >
                  <CardView card={card} />
                </button>
              )
            })}

            {!playerState ? (
              <p className="text-sm text-slate-400">Loading your cards...</p>
            ) : null}
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
            <h2 className="font-bold">Your Clues</h2>

            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-slate-950 p-4">
                <p className="text-sm text-slate-400">YES pile</p>
                <p className="text-3xl font-black text-emerald-300">
                  {playerState?.yesPile.length ?? 0}
                </p>
              </div>

              <div className="rounded-xl bg-slate-950 p-4">
                <p className="text-sm text-slate-400">NO pile</p>
                <p className="text-3xl font-black text-rose-300">
                  {playerState?.noPile.length ?? 0}
                </p>
              </div>
            </div>

            <div className="mt-4 space-y-3">
              {playerState?.yesPile.map((card) => (
                <CardView key={`yes-${card.id}`} card={card} label="YES" />
              ))}

              {playerState?.noPile.map((card) => (
                <CardView key={`no-${card.id}`} card={card} label="NO" />
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
            <h2 className="font-bold">Other Identities</h2>

            <div className="mt-4 space-y-3">
              {visibleIdentities.map((identity) => (
                <CardView
                  key={identity.playerId}
                  card={identity.hiddenIdentity}
                  label={playerNameById.get(identity.playerId) ?? 'Player'}
                />
              ))}

              {visibleIdentities.length === 0 ? (
                <p className="text-sm text-slate-400">
                  Waiting for other player identities...
                </p>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
EOF

npm run check

echo ""
echo "Reveal-card patch complete."
echo "Run: npm run dev"
