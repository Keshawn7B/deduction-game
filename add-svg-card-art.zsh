#!/usr/bin/env zsh
set -e

cd ~/deduction-game

cat > src/components/game/CardArt.tsx <<'EOF'
import { useId } from 'react'
import type { Animal, Disguise, Location } from '../../types/card'

type CardArtProps = {
  animal: Animal
  disguise: Disguise
  location: Location
}

const locationGradients: Record<Location, [string, string]> = {
  Beach: ['#38bdf8', '#fbbf24'],
  Moon: ['#111827', '#64748b'],
  Castle: ['#312e81', '#94a3b8'],
  Forest: ['#064e3b', '#22c55e'],
  Museum: ['#44403c', '#d6d3d1'],
  Kitchen: ['#7c2d12', '#f97316'],
  Volcano: ['#450a0a', '#ef4444'],
  Library: ['#431407', '#a16207'],
}

const animalColors: Record<
  Animal,
  { main: string; light: string; dark: string }
> = {
  Fox: { main: '#f97316', light: '#fed7aa', dark: '#7c2d12' },
  Dog: { main: '#a16207', light: '#fde68a', dark: '#422006' },
  Cat: { main: '#64748b', light: '#e2e8f0', dark: '#1e293b' },
  Bear: { main: '#854d0e', light: '#fef3c7', dark: '#422006' },
  Rabbit: { main: '#e5e7eb', light: '#fdf2f8', dark: '#9ca3af' },
  Penguin: { main: '#111827', light: '#f8fafc', dark: '#020617' },
  Lizard: { main: '#16a34a', light: '#bbf7d0', dark: '#14532d' },
  Owl: { main: '#92400e', light: '#fde68a', dark: '#451a03' },
}

function LocationBackground({ location }: { location: Location }) {
  switch (location) {
    case 'Beach':
      return (
        <g>
          <circle cx="258" cy="72" r="28" fill="#fde047" opacity="0.95" />
          <path d="M0 300 C70 270 130 330 200 300 C250 280 290 292 320 278 V420 H0 Z" fill="#fbbf24" />
          <path d="M0 265 C65 245 130 290 190 265 C245 240 290 255 320 240" fill="none" stroke="#e0f2fe" strokeWidth="12" opacity="0.9" />
        </g>
      )
    case 'Moon':
      return (
        <g>
          <circle cx="250" cy="82" r="34" fill="#e5e7eb" />
          <circle cx="263" cy="70" r="34" fill="#111827" opacity="0.8" />
          <circle cx="58" cy="82" r="3" fill="#f8fafc" />
          <circle cx="98" cy="44" r="2" fill="#f8fafc" />
          <circle cx="284" cy="162" r="3" fill="#f8fafc" />
          <path d="M0 330 C80 300 130 340 220 310 C260 298 292 305 320 292 V420 H0 Z" fill="#475569" />
        </g>
      )
    case 'Castle':
      return (
        <g>
          <path d="M40 315 V160 H82 V122 H120 V160 H148 V122 H186 V160 H216 V122 H254 V160 H280 V315 Z" fill="#475569" opacity="0.9" />
          <path d="M122 315 V242 C122 218 198 218 198 242 V315 Z" fill="#1e293b" />
          <path d="M0 328 H320 V420 H0 Z" fill="#334155" />
        </g>
      )
    case 'Forest':
      return (
        <g>
          <path d="M55 305 L95 180 L135 305 Z" fill="#14532d" />
          <path d="M160 315 L210 155 L260 315 Z" fill="#166534" />
          <path d="M5 320 L50 200 L95 320 Z" fill="#15803d" />
          <rect x="0" y="318" width="320" height="102" fill="#064e3b" />
        </g>
      )
    case 'Museum':
      return (
        <g>
          <path d="M45 145 H275 L160 78 Z" fill="#d6d3d1" />
          <rect x="60" y="160" width="32" height="150" fill="#a8a29e" />
          <rect x="116" y="160" width="32" height="150" fill="#a8a29e" />
          <rect x="172" y="160" width="32" height="150" fill="#a8a29e" />
          <rect x="228" y="160" width="32" height="150" fill="#a8a29e" />
          <rect x="35" y="310" width="250" height="28" fill="#78716c" />
        </g>
      )
    case 'Kitchen':
      return (
        <g>
          <rect x="0" y="0" width="320" height="420" fill="#fed7aa" opacity="0.18" />
          <path d="M0 120 H320 M0 190 H320 M0 260 H320 M0 330 H320 M80 0 V420 M160 0 V420 M240 0 V420" stroke="#fdba74" strokeWidth="4" opacity="0.35" />
          <rect x="40" y="282" width="240" height="72" rx="18" fill="#7c2d12" opacity="0.65" />
        </g>
      )
    case 'Volcano':
      return (
        <g>
          <path d="M95 330 L160 115 L235 330 Z" fill="#7f1d1d" />
          <path d="M141 178 L160 115 L182 178 C170 170 153 170 141 178 Z" fill="#f97316" />
          <path d="M145 180 C155 230 130 260 150 330" stroke="#fb923c" strokeWidth="10" strokeLinecap="round" />
          <path d="M175 180 C188 230 170 258 192 330" stroke="#ef4444" strokeWidth="10" strokeLinecap="round" />
          <rect x="0" y="330" width="320" height="90" fill="#1f2937" />
        </g>
      )
    case 'Library':
      return (
        <g>
          <rect x="35" y="102" width="250" height="250" rx="16" fill="#78350f" opacity="0.72" />
          <path d="M58 128 H262 M58 192 H262 M58 256 H262 M58 320 H262" stroke="#f59e0b" strokeWidth="7" opacity="0.45" />
          <path d="M78 128 V184 M108 128 V184 M138 128 V184 M198 128 V184 M230 128 V184" stroke="#fde68a" strokeWidth="12" />
          <path d="M75 194 V248 M126 194 V248 M168 194 V248 M220 194 V248" stroke="#f97316" strokeWidth="12" />
        </g>
      )
  }
}

function AnimalBody({ animal }: { animal: Animal }) {
  const colors = animalColors[animal]

  switch (animal) {
    case 'Penguin':
      return (
        <g>
          <ellipse cx="160" cy="230" rx="70" ry="88" fill={colors.main} />
          <ellipse cx="160" cy="246" rx="46" ry="58" fill={colors.light} />
          <circle cx="136" cy="190" r="8" fill="#f8fafc" />
          <circle cx="184" cy="190" r="8" fill="#f8fafc" />
          <circle cx="136" cy="190" r="4" fill="#020617" />
          <circle cx="184" cy="190" r="4" fill="#020617" />
          <path d="M150 205 L170 205 L160 220 Z" fill="#f97316" />
          <path d="M105 250 C68 270 78 310 112 294" fill={colors.dark} />
          <path d="M215 250 C252 270 242 310 208 294" fill={colors.dark} />
        </g>
      )
    case 'Rabbit':
      return (
        <g>
          <ellipse cx="132" cy="112" rx="20" ry="58" fill={colors.main} transform="rotate(-12 132 112)" />
          <ellipse cx="188" cy="112" rx="20" ry="58" fill={colors.main} transform="rotate(12 188 112)" />
          <ellipse cx="132" cy="114" rx="9" ry="40" fill={colors.light} transform="rotate(-12 132 114)" />
          <ellipse cx="188" cy="114" rx="9" ry="40" fill={colors.light} transform="rotate(12 188 114)" />
          <circle cx="160" cy="205" r="68" fill={colors.main} />
          <ellipse cx="160" cy="232" rx="38" ry="28" fill={colors.light} />
          <circle cx="136" cy="194" r="6" fill="#020617" />
          <circle cx="184" cy="194" r="6" fill="#020617" />
          <path d="M152 212 Q160 220 168 212" stroke={colors.dark} strokeWidth="5" fill="none" strokeLinecap="round" />
        </g>
      )
    case 'Fox':
      return (
        <g>
          <path d="M102 158 L124 96 L150 158 Z" fill={colors.main} />
          <path d="M218 158 L196 96 L170 158 Z" fill={colors.main} />
          <path d="M112 148 L126 116 L140 150 Z" fill={colors.light} />
          <path d="M208 148 L194 116 L180 150 Z" fill={colors.light} />
          <circle cx="160" cy="205" r="70" fill={colors.main} />
          <path d="M118 220 Q160 295 202 220 Q180 242 160 242 Q140 242 118 220 Z" fill={colors.light} />
          <circle cx="136" cy="194" r="6" fill="#020617" />
          <circle cx="184" cy="194" r="6" fill="#020617" />
          <path d="M150 216 L170 216 L160 230 Z" fill="#020617" />
        </g>
      )
    case 'Cat':
      return (
        <g>
          <path d="M104 160 L126 102 L150 160 Z" fill={colors.main} />
          <path d="M216 160 L194 102 L170 160 Z" fill={colors.main} />
          <circle cx="160" cy="205" r="70" fill={colors.main} />
          <ellipse cx="160" cy="232" rx="38" ry="28" fill={colors.light} />
          <circle cx="136" cy="194" r="6" fill="#020617" />
          <circle cx="184" cy="194" r="6" fill="#020617" />
          <path d="M152 216 L168 216 L160 228 Z" fill="#020617" />
          <path d="M118 222 H75 M118 235 H78 M202 222 H245 M202 235 H242" stroke={colors.dark} strokeWidth="4" strokeLinecap="round" />
        </g>
      )
    case 'Dog':
      return (
        <g>
          <ellipse cx="106" cy="190" rx="28" ry="62" fill={colors.dark} transform="rotate(18 106 190)" />
          <ellipse cx="214" cy="190" rx="28" ry="62" fill={colors.dark} transform="rotate(-18 214 190)" />
          <circle cx="160" cy="205" r="70" fill={colors.main} />
          <ellipse cx="160" cy="232" rx="42" ry="30" fill={colors.light} />
          <circle cx="136" cy="194" r="6" fill="#020617" />
          <circle cx="184" cy="194" r="6" fill="#020617" />
          <ellipse cx="160" cy="220" rx="12" ry="8" fill="#020617" />
        </g>
      )
    case 'Bear':
      return (
        <g>
          <circle cx="104" cy="150" r="28" fill={colors.main} />
          <circle cx="216" cy="150" r="28" fill={colors.main} />
          <circle cx="160" cy="205" r="76" fill={colors.main} />
          <ellipse cx="160" cy="232" rx="44" ry="32" fill={colors.light} />
          <circle cx="136" cy="194" r="6" fill="#020617" />
          <circle cx="184" cy="194" r="6" fill="#020617" />
          <ellipse cx="160" cy="220" rx="12" ry="8" fill="#020617" />
        </g>
      )
    case 'Lizard':
      return (
        <g>
          <path d="M90 255 C50 248 45 210 78 190 C76 230 105 232 120 220 Z" fill={colors.dark} />
          <ellipse cx="160" cy="218" rx="82" ry="56" fill={colors.main} />
          <ellipse cx="160" cy="238" rx="48" ry="24" fill={colors.light} opacity="0.75" />
          <circle cx="132" cy="198" r="8" fill="#f8fafc" />
          <circle cx="188" cy="198" r="8" fill="#f8fafc" />
          <circle cx="132" cy="198" r="4" fill="#020617" />
          <circle cx="188" cy="198" r="4" fill="#020617" />
          <path d="M145 222 Q160 230 175 222" stroke={colors.dark} strokeWidth="5" fill="none" strokeLinecap="round" />
        </g>
      )
    case 'Owl':
      return (
        <g>
          <path d="M102 162 L122 102 L154 150 Z" fill={colors.dark} />
          <path d="M218 162 L198 102 L166 150 Z" fill={colors.dark} />
          <ellipse cx="160" cy="215" rx="76" ry="88" fill={colors.main} />
          <ellipse cx="160" cy="244" rx="42" ry="38" fill={colors.light} opacity="0.9" />
          <circle cx="134" cy="196" r="20" fill={colors.light} />
          <circle cx="186" cy="196" r="20" fill={colors.light} />
          <circle cx="134" cy="196" r="8" fill="#020617" />
          <circle cx="186" cy="196" r="8" fill="#020617" />
          <path d="M150 216 L170 216 L160 234 Z" fill="#f59e0b" />
        </g>
      )
  }
}

function DisguiseLayer({ disguise }: { disguise: Disguise }) {
  switch (disguise) {
    case 'Pirate':
      return (
        <g>
          <path d="M96 165 C130 130 200 130 224 165 L210 180 C180 160 138 160 108 180 Z" fill="#991b1b" />
          <circle cx="184" cy="196" r="15" fill="#020617" />
          <path d="M169 190 L128 176" stroke="#020617" strokeWidth="7" strokeLinecap="round" />
        </g>
      )
    case 'Astronaut':
      return (
        <g>
          <circle cx="160" cy="205" r="88" fill="none" stroke="#e0f2fe" strokeWidth="12" opacity="0.85" />
          <path d="M90 276 H230" stroke="#e0f2fe" strokeWidth="16" strokeLinecap="round" />
          <circle cx="218" cy="160" r="10" fill="#38bdf8" />
        </g>
      )
    case 'Wizard':
      return (
        <g>
          <path d="M108 152 L160 54 L212 152 Z" fill="#4c1d95" />
          <path d="M102 152 H218" stroke="#a78bfa" strokeWidth="14" strokeLinecap="round" />
          <circle cx="157" cy="102" r="7" fill="#fde047" />
          <path d="M180 90 L190 102 L203 95 L195 110 L206 120 L190 119 L186 134 L180 119 L164 120 L176 110 L168 95 Z" fill="#fde047" />
        </g>
      )
    case 'Detective':
      return (
        <g>
          <path d="M96 158 H224 L202 125 H118 Z" fill="#292524" />
          <path d="M112 124 H208" stroke="#78716c" strokeWidth="10" strokeLinecap="round" />
          <circle cx="218" cy="245" r="24" fill="none" stroke="#0f172a" strokeWidth="8" />
          <path d="M236 263 L268 295" stroke="#0f172a" strokeWidth="10" strokeLinecap="round" />
        </g>
      )
    case 'Knight':
      return (
        <g>
          <path d="M100 174 C110 115 210 115 220 174 V215 H100 Z" fill="#94a3b8" opacity="0.92" />
          <path d="M118 180 H202" stroke="#334155" strokeWidth="12" strokeLinecap="round" />
          <path d="M132 164 H188" stroke="#e2e8f0" strokeWidth="8" strokeLinecap="round" />
        </g>
      )
    case 'Chef':
      return (
        <g>
          <circle cx="124" cy="120" r="24" fill="#f8fafc" />
          <circle cx="160" cy="104" r="30" fill="#f8fafc" />
          <circle cx="196" cy="120" r="24" fill="#f8fafc" />
          <rect x="112" y="128" width="96" height="42" rx="12" fill="#f8fafc" />
          <path d="M122 170 H198" stroke="#cbd5e1" strokeWidth="6" />
        </g>
      )
    case 'Robot':
      return (
        <g>
          <rect x="102" y="150" width="116" height="86" rx="18" fill="#64748b" opacity="0.86" />
          <rect x="124" y="178" width="72" height="28" rx="8" fill="#0f172a" />
          <circle cx="142" cy="192" r="6" fill="#22d3ee" />
          <circle cx="178" cy="192" r="6" fill="#22d3ee" />
          <path d="M160 150 V118" stroke="#94a3b8" strokeWidth="7" strokeLinecap="round" />
          <circle cx="160" cy="112" r="9" fill="#f87171" />
        </g>
      )
    case 'Ninja':
      return (
        <g>
          <path d="M93 165 C120 130 202 130 227 165 V222 C200 245 120 245 93 222 Z" fill="#020617" opacity="0.72" />
          <rect x="112" y="176" width="96" height="38" rx="16" fill="#f8fafc" opacity="0.88" />
          <path d="M126 195 H194" stroke="#020617" strokeWidth="5" strokeLinecap="round" />
        </g>
      )
  }
}

export function CardArt({ animal, disguise, location }: CardArtProps) {
  const gradientId = useId().replaceAll(':', '')
  const [startColor, endColor] = locationGradients[location]

  return (
    <svg
      viewBox="0 0 320 420"
      className="h-full w-full"
      role="img"
      aria-label={`${animal} dressed as ${disguise} at ${location}`}
    >
      <defs>
        <linearGradient id={gradientId} x1="0" x2="1" y1="0" y2="1">
          <stop offset="0%" stopColor={startColor} />
          <stop offset="100%" stopColor={endColor} />
        </linearGradient>
      </defs>

      <rect width="320" height="420" rx="32" fill={`url(#${gradientId})`} />
      <LocationBackground location={location} />

      <g filter="drop-shadow(0 18px 16px rgb(2 6 23 / 0.35))">
        <AnimalBody animal={animal} />
        <DisguiseLayer disguise={disguise} />
      </g>

      <rect
        x="10"
        y="10"
        width="300"
        height="400"
        rx="26"
        fill="none"
        stroke="#f8fafc"
        strokeWidth="5"
        opacity="0.22"
      />
    </svg>
  )
}
EOF

cat > src/components/game/CardView.tsx <<'EOF'
import type { Card } from '../../types/card'
import { CardArt } from './CardArt'

type CardViewProps = {
  card: Card
  label?: string
}

export function CardView({ card, label }: CardViewProps) {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-700 bg-slate-950 shadow transition hover:border-cyan-400/60">
      <div className="aspect-[3/4] bg-slate-900">
        <CardArt
          animal={card.animal}
          disguise={card.disguise}
          location={card.location}
        />
      </div>

      <div className="p-4">
        {label ? (
          <p className="mb-3 inline-flex rounded-full bg-slate-800 px-3 py-1 text-xs font-bold uppercase tracking-[0.2em] text-cyan-300">
            {label}
          </p>
        ) : null}

        <p className="text-lg font-black text-slate-100">{card.animal}</p>
        <p className="mt-1 text-sm text-slate-300">{card.disguise}</p>
        <p className="text-sm text-slate-400">{card.location}</p>
      </div>
    </div>
  )
}
EOF

npm run check

echo ""
echo "SVG card art system complete."
echo "Run: npm run dev"
