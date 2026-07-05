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
import { isCorrectGuess, applyWrongGuessPenalty } from '../game/guess'
import { getClueResult } from '../game/rules'
import { createInitialGameState } from '../game/setup'
import type { Card, Guess } from '../types/card'
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

  const nextTurnPlayerId = getNextActiveTurnPlayerId({
    players,
    states,
    currentPlayerId: params.playerId,
    currentPlayerNextState: nextPlayerState,
  })

  batch.set(playerStateRef, nextPlayerState)
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

cat > src/pages/GuessPage.tsx <<'EOF'
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Button } from '../components/ui/Button'
import { useAuth } from '../context/AuthContext'
import { ANIMALS, DISGUISES, LOCATIONS } from '../game/deck'
import { makeGuess } from '../firebase/rooms'
import type { Animal, Disguise, Location } from '../types/card'

export function GuessPage() {
  const { roomCode = '' } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()

  const [animal, setAnimal] = useState<Animal>(ANIMALS[0])
  const [disguise, setDisguise] = useState<Disguise>(DISGUISES[0])
  const [location, setLocation] = useState<Location>(LOCATIONS[0])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  async function handleGuess() {
    if (!user) {
      setError('You are not signed in.')
      return
    }

    setBusy(true)
    setError('')
    setMessage('')

    try {
      const result = await makeGuess({
        roomCode,
        playerId: user.uid,
        guess: {
          animal,
          disguise,
          location,
        },
      })

      if (result.correct) {
        navigate(`/winner/${roomCode}`)
        return
      }

      if (result.eliminated) {
        setMessage('Wrong guess. You are eliminated.')
      } else {
        setMessage(`Wrong guess. Wrong guesses: ${result.wrongGuesses}/3.`)
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Could not make guess.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="mx-auto min-h-screen max-w-2xl px-4 py-8">
      <h1 className="text-3xl font-black">Make a Guess</h1>

      <p className="mt-2 text-sm text-slate-400">
        You may only guess on your turn. A correct full guess wins the game.
      </p>

      <div className="mt-6 space-y-4 rounded-2xl border border-slate-800 bg-slate-900 p-5">
        <label className="block">
          <span className="text-sm font-semibold text-slate-300">Animal</span>
          <select
            value={animal}
            onChange={(event) => setAnimal(event.target.value as Animal)}
            className="mt-2 w-full rounded-xl bg-slate-950 p-3"
          >
            {ANIMALS.map((value) => (
              <option key={value}>{value}</option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="text-sm font-semibold text-slate-300">Disguise</span>
          <select
            value={disguise}
            onChange={(event) => setDisguise(event.target.value as Disguise)}
            className="mt-2 w-full rounded-xl bg-slate-950 p-3"
          >
            {DISGUISES.map((value) => (
              <option key={value}>{value}</option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="text-sm font-semibold text-slate-300">Location</span>
          <select
            value={location}
            onChange={(event) => setLocation(event.target.value as Location)}
            className="mt-2 w-full rounded-xl bg-slate-950 p-3"
          >
            {LOCATIONS.map((value) => (
              <option key={value}>{value}</option>
            ))}
          </select>
        </label>

        {message ? (
          <p className="rounded-xl border border-amber-500/50 bg-amber-950/30 px-4 py-3 text-sm text-amber-100">
            {message}
          </p>
        ) : null}

        {error ? (
          <p className="rounded-xl border border-rose-500/50 bg-rose-950/40 px-4 py-3 text-sm text-rose-200">
            {error}
          </p>
        ) : null}

        <div className="flex gap-3">
          <Button onClick={handleGuess} disabled={busy}>
            {busy ? 'Checking...' : 'Confirm Guess'}
          </Button>

          <Link to={`/game/${roomCode}`}>
            <Button variant="secondary">Cancel</Button>
          </Link>
        </div>
      </div>
    </section>
  )
}
EOF

cat > src/pages/WinnerPage.tsx <<'EOF'
import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { CardView } from '../components/game/CardView'
import { Button } from '../components/ui/Button'
import {
  listenToIdentities,
  listenToPlayers,
  listenToRoom,
} from '../firebase/rooms'
import type { PlayerIdentityDoc } from '../types/game'
import type { LobbyPlayer, RoomDoc } from '../types/room'

export function WinnerPage() {
  const { roomCode = '' } = useParams()

  const [room, setRoom] = useState<RoomDoc | null>(null)
  const [players, setPlayers] = useState<LobbyPlayer[]>([])
  const [identities, setIdentities] = useState<PlayerIdentityDoc[]>([])

  useEffect(() => {
    if (!roomCode) return

    const unsubscribeRoom = listenToRoom(roomCode, setRoom)
    const unsubscribePlayers = listenToPlayers(roomCode, setPlayers)
    const unsubscribeIdentities = listenToIdentities(roomCode, setIdentities)

    return () => {
      unsubscribeRoom()
      unsubscribePlayers()
      unsubscribeIdentities()
    }
  }, [roomCode])

  const playerNameById = useMemo(() => {
    return new Map(players.map((player) => [player.id, player.name]))
  }, [players])

  const winnerName = room?.winnerId
    ? playerNameById.get(room.winnerId) ?? 'Winner'
    : 'Winner'

  return (
    <section className="mx-auto flex min-h-screen max-w-4xl flex-col justify-center px-4 py-10">
      <div className="rounded-3xl border border-slate-800 bg-slate-900 p-6">
        <p className="text-sm font-semibold uppercase tracking-[0.3em] text-cyan-300">
          Room {roomCode}
        </p>

        <h1 className="mt-3 text-4xl font-black">{winnerName} wins</h1>

        <p className="mt-3 text-slate-300">
          Hidden identities are now revealed.
        </p>

        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          {identities.map((identity) => (
            <CardView
              key={identity.playerId}
              card={identity.hiddenIdentity}
              label={playerNameById.get(identity.playerId) ?? 'Player'}
            />
          ))}
        </div>

        <div className="mt-6 flex gap-3">
          <Link to="/">
            <Button variant="secondary">Return Home</Button>
          </Link>
        </div>
      </div>
    </section>
  )
}
EOF

python3 - <<'PY'
from pathlib import Path

path = Path("src/pages/GamePage.tsx")
text = path.read_text()

text = text.replace(
"""                <p className="text-sm text-slate-400">YES pile</p>
                <p className="text-3xl font-black text-emerald-300">
                  {playerState?.yesPile.length ?? 0}
                </p>""",
"""                <p className="text-sm text-slate-400">YES pile</p>
                <p className="text-3xl font-black text-emerald-300">
                  {playerState?.hideYesPile
                    ? 'Hidden'
                    : (playerState?.yesPile.length ?? 0)}
                </p>"""
)

text = text.replace(
"""                <p className="text-sm text-slate-400">NO pile</p>
                <p className="text-3xl font-black text-rose-300">
                  {playerState?.noPile.length ?? 0}
                </p>""",
"""                <p className="text-sm text-slate-400">NO pile</p>
                <p className="text-3xl font-black text-rose-300">
                  {playerState?.hideNoPile
                    ? 'Hidden'
                    : (playerState?.noPile.length ?? 0)}
                </p>"""
)

text = text.replace(
"""              {playerState?.yesPile.map((card) => (
                <CardView key={`yes-${card.id}`} card={card} label="YES" />
              ))}

              {playerState?.noPile.map((card) => (
                <CardView key={`no-${card.id}`} card={card} label="NO" />
              ))}""",
"""              {!playerState?.hideYesPile
                ? playerState?.yesPile.map((card) => (
                    <CardView key={`yes-${card.id}`} card={card} label="YES" />
                  ))
                : null}

              {!playerState?.hideNoPile
                ? playerState?.noPile.map((card) => (
                    <CardView key={`no-${card.id}`} card={card} label="NO" />
                  ))
                : null}"""
)

path.write_text(text)
PY

npm run check

echo ""
echo "Guess patch complete."
echo "Run: npm run dev"
