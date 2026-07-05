#!/usr/bin/env zsh
set -e

cd ~/deduction-game

cat > src/game/cardAssets.ts <<'EOF'
import type { Animal, Disguise, Location } from '../types/card'

export type LayerAsset = {
  src: string
  alt: string
  className: string
}

export const backgroundAssets: Record<Location, string> = {
  Beach: '/assets/cards/backgrounds/bkg1.png',
  Moon: '/assets/cards/backgrounds/bkg2.png',
  Castle: '/assets/cards/backgrounds/bkg3.png',
  Forest: '/assets/cards/backgrounds/bkg4.png',
  Museum: '/assets/cards/backgrounds/bkg5.png',
  Kitchen: '/assets/cards/backgrounds/bkg6.png',
  Volcano: '/assets/cards/backgrounds/bkg7.png',
  Library: '/assets/cards/backgrounds/bkg8.png',
}

export const backgroundFallbacks: Record<Location, string> = {
  Beach: 'linear-gradient(160deg, #38bdf8, #facc15)',
  Moon: 'linear-gradient(160deg, #020617, #64748b)',
  Castle: 'linear-gradient(160deg, #312e81, #94a3b8)',
  Forest: 'linear-gradient(160deg, #064e3b, #22c55e)',
  Museum: 'linear-gradient(160deg, #44403c, #d6d3d1)',
  Kitchen: 'linear-gradient(160deg, #7c2d12, #fb923c)',
  Volcano: 'linear-gradient(160deg, #450a0a, #ef4444)',
  Library: 'linear-gradient(160deg, #431407, #a16207)',
}

export const animalAssets: Record<Animal, LayerAsset> = {
  Fox: {
    src: '/assets/cards/animals/aml1.png',
    alt: 'Fox portrait',
    className: 'left-[12%] top-[24%] h-[60%] w-[76%]',
  },
  Dog: {
    src: '/assets/cards/animals/aml2.png',
    alt: 'Dog portrait',
    className: 'left-[9%] top-[24%] h-[62%] w-[82%]',
  },
  Cat: {
    src: '/assets/cards/animals/aml3.png',
    alt: 'Cat portrait',
    className: 'left-[11%] top-[24%] h-[61%] w-[78%]',
  },
  Bear: {
    src: '/assets/cards/animals/aml4.png',
    alt: 'Bear portrait',
    className: 'left-[5%] top-[21%] h-[64%] w-[90%]',
  },
  Rabbit: {
    src: '/assets/cards/animals/aml5.png',
    alt: 'Rabbit portrait',
    className: 'left-[10%] top-[16%] h-[68%] w-[80%]',
  },
  Penguin: {
    src: '/assets/cards/animals/aml6.png',
    alt: 'Penguin portrait',
    className: 'left-[8%] top-[25%] h-[62%] w-[84%]',
  },
  Lizard: {
    src: '/assets/cards/animals/aml7.png',
    alt: 'Lizard portrait',
    className: 'left-[7%] top-[28%] h-[58%] w-[86%]',
  },
  Owl: {
    src: '/assets/cards/animals/aml8.png',
    alt: 'Owl portrait',
    className: 'left-[8%] top-[20%] h-[65%] w-[84%]',
  },
}

export const accessoryAssets: Record<Disguise, LayerAsset> = {
  Pirate: {
    src: '/assets/cards/accessories/acc1.png',
    alt: 'Pirate accessory',
    className: 'left-[2%] top-[2%] h-[40%] w-[96%]',
  },
  Wizard: {
    src: '/assets/cards/accessories/acc2.png',
    alt: 'Wizard accessory',
    className: 'left-[6%] top-[-2%] h-[44%] w-[88%]',
  },
  Detective: {
    src: '/assets/cards/accessories/acc3.png',
    alt: 'Detective accessory',
    className: 'left-[8%] top-[8%] h-[34%] w-[84%]',
  },
  Crown: {
    src: '/assets/cards/accessories/acc4.png',
    alt: 'Crown accessory',
    className: 'left-[10%] top-[8%] h-[26%] w-[80%]',
  },
  Chef: {
    src: '/assets/cards/accessories/acc5.png',
    alt: 'Chef accessory',
    className: 'left-[5%] top-[0%] h-[34%] w-[90%]',
  },
  Aviator: {
    src: '/assets/cards/accessories/acc6.png',
    alt: 'Aviator accessory',
    className: 'left-[3%] top-[20%] h-[36%] w-[94%]',
  },
  Knight: {
    src: '/assets/cards/accessories/acc7.png',
    alt: 'Knight accessory',
    className: 'left-[7%] top-[13%] h-[44%] w-[86%]',
  },
  Explorer: {
    src: '/assets/cards/accessories/acc8.png',
    alt: 'Explorer accessory',
    className: 'left-[4%] top-[8%] h-[34%] w-[92%]',
  },
}

const legacyAccessoryMap: Record<string, Disguise> = {
  Astronaut: 'Aviator',
  Robot: 'Knight',
  Ninja: 'Explorer',
}

export function normalizeAccessory(value: string): Disguise {
  if (value in accessoryAssets) {
    return value as Disguise
  }

  return legacyAccessoryMap[value] ?? 'Pirate'
}

export function getAccessoryAsset(value: string): LayerAsset {
  return accessoryAssets[normalizeAccessory(value)]
}
EOF

cat > src/components/game/LayeredCardArt.tsx <<'EOF'
import type { Card } from '../../types/card'
import {
  animalAssets,
  backgroundAssets,
  backgroundFallbacks,
  getAccessoryAsset,
  normalizeAccessory,
} from '../../game/cardAssets'

type LayeredCardArtProps = {
  card: Card
}

function hideBrokenImage(event: React.SyntheticEvent<HTMLImageElement>) {
  event.currentTarget.style.display = 'none'
}

export function LayeredCardArt({ card }: LayeredCardArtProps) {
  const animal = animalAssets[card.animal]
  const accessory = getAccessoryAsset(card.disguise)
  const accessoryName = normalizeAccessory(card.disguise)
  const background = backgroundAssets[card.location]
  const fallback = backgroundFallbacks[card.location]

  return (
    <div
      className="relative h-full w-full overflow-hidden bg-cover bg-center"
      style={{
        backgroundImage: `url(${background}), ${fallback}`,
      }}
      aria-label={`${card.animal} wearing ${accessoryName} at ${card.location}`}
      role="img"
    >
      <div className="absolute inset-0 bg-gradient-to-b from-white/10 via-transparent to-slate-950/40" />

      <div className="absolute left-[7%] top-[8%] rounded-full bg-slate-950/55 px-3 py-1 text-xs font-black uppercase tracking-[0.22em] text-white shadow">
        {card.location}
      </div>

      <img
        src={animal.src}
        alt={animal.alt}
        className={`absolute object-contain object-center drop-shadow-2xl ${animal.className}`}
        draggable={false}
        onError={hideBrokenImage}
      />

      <img
        src={accessory.src}
        alt={accessory.alt}
        className={`absolute object-contain object-center drop-shadow-xl ${accessory.className}`}
        draggable={false}
        onError={hideBrokenImage}
      />

      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-slate-950 via-slate-950/88 to-transparent px-4 pb-4 pt-14">
        <p className="text-xl font-black leading-none text-white drop-shadow">
          {card.animal}
        </p>
        <p className="mt-1 text-sm font-bold text-cyan-200 drop-shadow">
          {accessoryName}
        </p>
      </div>

      <div className="pointer-events-none absolute inset-2 rounded-2xl border border-white/25" />
    </div>
  )
}
EOF

cat > src/components/game/CardView.tsx <<'EOF'
import { normalizeAccessory } from '../../game/cardAssets'
import type { Card } from '../../types/card'
import { LayeredCardArt } from './LayeredCardArt'

type CardViewProps = {
  card: Card
  label?: string
}

export function CardView({ card, label }: CardViewProps) {
  const accessoryName = normalizeAccessory(card.disguise)

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-700 bg-slate-950 shadow transition hover:border-cyan-400/60">
      <div className="relative aspect-[3/4] bg-slate-900">
        {label ? (
          <div className="absolute right-3 top-3 z-10 rounded-full bg-cyan-300 px-3 py-1 text-xs font-black uppercase tracking-[0.18em] text-slate-950 shadow">
            {label}
          </div>
        ) : null}

        <LayeredCardArt card={card} />
      </div>

      <div className="grid grid-cols-3 gap-px bg-slate-800 text-center text-xs">
        <div className="bg-slate-950 px-2 py-2">
          <p className="font-bold text-slate-500">Animal</p>
          <p className="mt-1 font-black text-slate-100">{card.animal}</p>
        </div>

        <div className="bg-slate-950 px-2 py-2">
          <p className="font-bold text-slate-500">Accessory</p>
          <p className="mt-1 font-black text-slate-100">{accessoryName}</p>
        </div>

        <div className="bg-slate-950 px-2 py-2">
          <p className="font-bold text-slate-500">Location</p>
          <p className="mt-1 font-black text-slate-100">{card.location}</p>
        </div>
      </div>
    </div>
  )
}
EOF

echo ""
echo "Checking for real old accessory references..."
if command -v rg >/dev/null 2>&1; then
  rg -n "'Astronaut'|'Robot'|'Ninja'|\\bAstronaut\\b|\\bNinja\\b" src || true
else
  grep -RInE "'Astronaut'|'Robot'|'Ninja'|\\bAstronaut\\b|\\bNinja\\b" src || true
fi

npm run check

echo ""
echo "Runtime compatibility fix complete."
echo "Old rooms containing Robot/Astronaut/Ninja will now render safely."
echo "Robot -> Knight, Astronaut -> Aviator, Ninja -> Explorer."
echo "Run: npm run dev"
