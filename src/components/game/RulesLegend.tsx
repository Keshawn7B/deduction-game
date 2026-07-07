import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { matchPath, useLocation } from 'react-router-dom'
import { listenToRoom } from '../../firebase/rooms'
import { getLegendGroups } from '../../game/cardSetLegend'
import { DEFAULT_CARD_SET_SIZE, normalizeCardSetSize } from '../../game/deck'
import type { CardSetSize } from '../../types/card'

const rules = [
  'Your hidden identity consists of 1 Animal, 1 Accessory, and 1 Background.',
  'On your turn, reveal 1 clue card.',
  'If the clue matches any part of your hidden identity, it goes to your YES pile. Otherwise, it goes to your NO pile.',
  'Use the clues in your YES and NO piles to determine your complete hidden identity.',
  'When you’re confident, guess your full hidden identity (Animal + Accessory + Background).',
]

const guessPenalties = [
  'One incorrect guess: One clue pile is hidden.',
  'Two incorrect guesses: Both clue piles are hidden.',
  'Three incorrect guesses: You’re eliminated from the game.',
]

const winningRule = 'The first player to correctly guess their complete hidden identity wins.'

const ROOM_ROUTE_PATTERNS = [
  '/lobby/:roomCode',
  '/game/:roomCode',
  '/game/:roomCode/guess',
  '/winner/:roomCode',
]

function getRoomCodeFromPath(pathname: string): string {
  for (const pattern of ROOM_ROUTE_PATTERNS) {
    const match = matchPath(pattern, pathname)

    if (match?.params.roomCode) {
      return match.params.roomCode
    }
  }

  return ''
}

export function RulesLegend() {
  const location = useLocation()
  const roomCode = useMemo(
    () => getRoomCodeFromPath(location.pathname),
    [location.pathname],
  )
  const [roomCardSetSize, setRoomCardSetSize] = useState<CardSetSize>(
    DEFAULT_CARD_SET_SIZE,
  )
  const cardSetSize = roomCode ? roomCardSetSize : DEFAULT_CARD_SET_SIZE
  const legendGroups = useMemo(() => getLegendGroups(cardSetSize), [cardSetSize])

  useEffect(() => {
    if (!roomCode) {
      return
    }

    return listenToRoom(roomCode, (room) => {
      setRoomCardSetSize(normalizeCardSetSize(room?.cardSetSize))
    })
  }, [roomCode])

  return (
    <aside className="fixed bottom-3 left-3 right-3 z-40 mx-auto max-w-5xl rounded-3xl border border-cyan-300/30 bg-slate-950/95 p-3 text-slate-100 shadow-2xl shadow-slate-950/60 backdrop-blur md:left-4 md:right-auto md:max-w-md">
      <details>
        <summary className="cursor-pointer select-none text-sm font-black uppercase tracking-[0.2em] text-cyan-300">
          Rules + Legend
        </summary>

        <div className="mt-4 max-h-[70vh] overflow-y-auto pr-1">
          <section className="rounded-2xl border border-slate-800 bg-slate-900/90 p-3">
            <h2 className="text-lg font-black">Simple rules</h2>
            <ol className="mt-3 space-y-2 text-sm text-slate-200">
              {rules.map((rule, index) => (
                <li key={rule} className="flex gap-2">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-cyan-300 text-xs font-black text-slate-950">
                    {index + 1}
                  </span>
                  <span>{rule}</span>
                </li>
              ))}
              <li className="flex gap-2">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-cyan-300 text-xs font-black text-slate-950">
                  {rules.length + 1}
                </span>
                <span>
                  Guess penalties:
                  <ul className="mt-1 list-disc space-y-1 pl-5 text-slate-300">
                    {guessPenalties.map((penalty) => (
                      <li key={penalty}>{penalty}</li>
                    ))}
                  </ul>
                </span>
              </li>
              <li className="flex gap-2">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-cyan-300 text-xs font-black text-slate-950">
                  {rules.length + 2}
                </span>
                <span>{winningRule}</span>
              </li>
            </ol>
          </section>

          <section className="mt-3 rounded-2xl border border-slate-800 bg-slate-900/90 p-3">
            <h2 className="text-lg font-black">Legend</h2>
            <p className="mt-1 text-xs text-slate-400">
              This game is using the {cardSetSize}x{cardSetSize}x{cardSetSize} card set.
            </p>

            {legendGroups.map((group) => (
              <LegendGroup key={group.name} title={group.title}>
                {group.items.map((item) => (
                  <LegendItem
                    key={item.name}
                    name={item.name}
                    image={item.image}
                    alt={item.alt}
                  />
                ))}
              </LegendGroup>
            ))}
          </section>
        </div>
      </details>
    </aside>
  )
}

type LegendGroupProps = {
  title: string
  children: ReactNode
}

function LegendGroup({ title, children }: LegendGroupProps) {
  return (
    <div className="mt-4">
      <h3 className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">
        {title}
      </h3>
      <div className="mt-2 grid grid-cols-4 gap-2">{children}</div>
    </div>
  )
}

type LegendItemProps = {
  name: string
  image: string
  alt: string
}

function LegendItem({ name, image, alt }: LegendItemProps) {
  return (
    <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-950 text-center">
      <div className="flex aspect-square items-center justify-center bg-slate-800/70 p-1">
        <img src={image} alt={alt} className="max-h-full max-w-full object-contain" draggable={false} />
      </div>
      <p className="truncate px-1 py-1 text-[0.65rem] font-black text-slate-200">
        {name}
      </p>
    </div>
  )
}
