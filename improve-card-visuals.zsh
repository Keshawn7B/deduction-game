#!/usr/bin/env zsh
set -e

cd ~/deduction-game

cat > src/components/game/CardView.tsx <<'EOF'
import type { Animal, Card, Disguise, Location } from '../../types/card'

type CardViewProps = {
  card: Card
  label?: string
}

const animalIcons: Record<Animal, string> = {
  Fox: '🦊',
  Dog: '🐶',
  Cat: '🐱',
  Bear: '🐻',
  Rabbit: '🐰',
  Penguin: '🐧',
  Lizard: '🦎',
  Owl: '🦉',
}

const disguiseIcons: Record<Disguise, string> = {
  Pirate: '🏴‍☠️',
  Astronaut: '🧑‍🚀',
  Wizard: '🧙',
  Detective: '🕵️',
  Knight: '🛡️',
  Chef: '👨‍🍳',
  Robot: '🤖',
  Ninja: '🥷',
}

const locationIcons: Record<Location, string> = {
  Beach: '🏖️',
  Moon: '🌙',
  Castle: '🏰',
  Forest: '🌲',
  Museum: '🏛️',
  Kitchen: '🍳',
  Volcano: '🌋',
  Library: '📚',
}

export function CardView({ card, label }: CardViewProps) {
  return (
    <div className="rounded-2xl border border-slate-700 bg-slate-950 p-4 shadow transition hover:border-cyan-400/60">
      {label ? (
        <p className="mb-3 inline-flex rounded-full bg-slate-800 px-3 py-1 text-xs font-bold uppercase tracking-[0.2em] text-cyan-300">
          {label}
        </p>
      ) : null}

      <div className="mb-4 flex items-center justify-center rounded-2xl bg-slate-900 py-5 text-5xl">
        <span aria-hidden="true">{animalIcons[card.animal]}</span>
      </div>

      <div className="space-y-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
            Animal
          </p>
          <p className="text-lg font-black text-slate-100">
            {animalIcons[card.animal]} {card.animal}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-xl bg-slate-900 p-3">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
              Disguise
            </p>
            <p className="mt-1 text-sm font-bold text-slate-200">
              {disguiseIcons[card.disguise]} {card.disguise}
            </p>
          </div>

          <div className="rounded-xl bg-slate-900 p-3">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
              Location
            </p>
            <p className="mt-1 text-sm font-bold text-slate-200">
              {locationIcons[card.location]} {card.location}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
EOF

npm run check

echo ""
echo "Card visuals patch complete."
echo "Run: npm run dev"
