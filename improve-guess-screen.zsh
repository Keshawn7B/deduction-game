#!/usr/bin/env zsh
set -e

cd ~/deduction-game

cat > src/pages/GuessPage.tsx <<'EOF'
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
  makeGuess,
} from '../firebase/rooms'
import { ANIMALS, DISGUISES, LOCATIONS } from '../game/deck'
import type { Animal, Disguise, Location } from '../types/card'
import type { PlayerGameState, PlayerIdentityDoc } from '../types/game'
import type { LobbyPlayer, RoomDoc } from '../types/room'

export function GuessPage() {
  const { roomCode = '' } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()

  const [room, setRoom] = useState<RoomDoc | null>(null)
  const [players, setPlayers] = useState<LobbyPlayer[]>([])
  const [playerState, setPlayerState] = useState<PlayerGameState | null>(null)
  const [identities, setIdentities] = useState<PlayerIdentityDoc[]>([])

  const [animal, setAnimal] = useState<Animal>(ANIMALS[0])
  const [disguise, setDisguise] = useState<Disguise>(DISGUISES[0])
  const [location, setLocation] = useState<Location>(LOCATIONS[0])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

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

  const isYourTurn = room?.currentTurnPlayerId === user?.uid
  const isEliminated = playerState?.eliminated ?? false

  const currentTurnName = useMemo(() => {
    const currentPlayer = players.find(
      (player) => player.id === room?.currentTurnPlayerId,
    )

    return currentPlayer?.name ?? 'Unknown'
  }, [players, room?.currentTurnPlayerId])

  const playerNameById = useMemo(() => {
    return new Map(players.map((player) => [player.id, player.name]))
  }, [players])

  const visibleIdentities = useMemo(
    () => identities.filter((identity) => identity.playerId !== user?.uid),
    [identities, user?.uid],
  )

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

      if (result.correct || result.gameFinished) {
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
    <section className="mx-auto min-h-screen max-w-6xl px-4 py-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-black">Make a Guess</h1>
          <p className="mt-2 text-sm text-slate-400">
            Current Turn: {currentTurnName}
          </p>
        </div>

        <Link to={`/game/${roomCode}`}>
          <Button variant="secondary">Back to Game</Button>
        </Link>
      </div>

      <div className="mt-4 rounded-2xl border border-slate-800 bg-slate-900 p-4">
        <p className="font-bold">
          {isEliminated
            ? 'You are eliminated'
            : isYourTurn
              ? 'Your turn'
              : `Waiting for ${currentTurnName}`}
        </p>
        <p className="mt-1 text-sm text-slate-400">
          A correct animal, disguise, and location wins immediately. A wrong
          guess applies the next penalty.
        </p>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-[1fr_1fr]">
        <div className="space-y-4">
          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
            <h2 className="font-bold">Your Guess</h2>

            <div className="mt-5 space-y-4">
              <label className="block">
                <span className="text-sm font-semibold text-slate-300">
                  Animal
                </span>
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
                <span className="text-sm font-semibold text-slate-300">
                  Disguise
                </span>
                <select
                  value={disguise}
                  onChange={(event) =>
                    setDisguise(event.target.value as Disguise)
                  }
                  className="mt-2 w-full rounded-xl bg-slate-950 p-3"
                >
                  {DISGUISES.map((value) => (
                    <option key={value}>{value}</option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="text-sm font-semibold text-slate-300">
                  Location
                </span>
                <select
                  value={location}
                  onChange={(event) =>
                    setLocation(event.target.value as Location)
                  }
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

              <Button
                onClick={handleGuess}
                disabled={!isYourTurn || isEliminated || busy}
                className="w-full"
              >
                {busy ? 'Checking...' : 'Confirm Guess'}
              </Button>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
            <h2 className="font-bold">Penalty Status</h2>

            <div className="mt-4 grid grid-cols-3 gap-3">
              <div className="rounded-xl bg-slate-950 p-3">
                <p className="text-xs text-slate-400">Wrong</p>
                <p className="text-2xl font-black text-amber-300">
                  {playerState?.wrongGuesses ?? 0}/3
                </p>
              </div>

              <div className="rounded-xl bg-slate-950 p-3">
                <p className="text-xs text-slate-400">YES</p>
                <p className="text-sm font-bold text-emerald-300">
                  {playerState?.hideYesPile ? 'Hidden' : 'Visible'}
                </p>
              </div>

              <div className="rounded-xl bg-slate-950 p-3">
                <p className="text-xs text-slate-400">NO</p>
                <p className="text-sm font-bold text-rose-300">
                  {playerState?.hideNoPile ? 'Hidden' : 'Visible'}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
            <h2 className="font-bold">Your Clue Cards</h2>

            <div className="mt-4 space-y-3">
              {!playerState?.hideYesPile
                ? playerState?.yesPile.map((card) => (
                    <CardView key={`yes-${card.id}`} card={card} label="YES" />
                  ))
                : null}

              {!playerState?.hideNoPile
                ? playerState?.noPile.map((card) => (
                    <CardView key={`no-${card.id}`} card={card} label="NO" />
                  ))
                : null}

              {playerState?.hideYesPile && playerState?.hideNoPile ? (
                <p className="rounded-xl bg-slate-950 p-4 text-sm text-slate-400">
                  Both clue piles are hidden.
                </p>
              ) : null}

              {playerState &&
              !playerState.hideYesPile &&
              !playerState.hideNoPile &&
              playerState.yesPile.length === 0 &&
              playerState.noPile.length === 0 ? (
                <p className="rounded-xl bg-slate-950 p-4 text-sm text-slate-400">
                  No clue cards yet.
                </p>
              ) : null}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
            <h2 className="font-bold">Other Identities</h2>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {visibleIdentities.map((identity) => (
                <CardView
                  key={identity.playerId}
                  card={identity.hiddenIdentity}
                  label={playerNameById.get(identity.playerId) ?? 'Player'}
                />
              ))}
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
echo "Guess screen info patch complete."
echo "Run: npm run dev"
