#!/usr/bin/env zsh
set -e

cd ~/deduction-game

mkdir -p public/assets/cards/backgrounds
mkdir -p public/assets/cards/animals
mkdir -p public/assets/cards/accessories
mkdir -p src/game
mkdir -p src/components/game

cat > public/assets/cards/README.md <<'EOF'
# Deducktion Card Art Assets

The card renderer layers 3 images:

1. Location background
2. Animal character PNG
3. Disguise/accessory PNG

Use these exact filenames.

## Backgrounds

Place these in:

`public/assets/cards/backgrounds/`

Recommended format: `.webp`

Required filenames:

- beach.webp
- moon.webp
- castle.webp
- forest.webp
- museum.webp
- kitchen.webp
- volcano.webp
- library.webp

Recommended size:

`1024x1365` or any 3:4 portrait image.

Backgrounds do not need transparency.

## Animals

Place these in:

`public/assets/cards/animals/`

Recommended format: `.png`

Required filenames:

- fox.png
- dog.png
- cat.png
- bear.png
- rabbit.png
- penguin.png
- lizard.png
- owl.png

Recommended size:

`1024x1024`

Animals should have transparent backgrounds.

Recommended composition:

- centered
- front-facing or slight 3/4 view
- full upper body visible
- no accessories
- same art style for all animals

## Accessories

Place these in:

`public/assets/cards/accessories/`

Recommended format: `.png`

Required filenames:

- pirate.png
- astronaut.png
- wizard.png
- detective.png
- knight.png
- chef.png
- robot.png
- ninja.png

Recommended size:

`1024x1024`

Accessories should have transparent backgrounds.

Recommended composition:

- centered
- designed to sit on top of the animal
- same style as animal art
- no background

## Suggested art style

Polished cute board-game card art, clean outlines, soft lighting, colorful, readable on mobile, original characters, no copyrighted characters.
EOF

cat > src/game/cardAssets.ts <<'EOF'
import type { Animal, Disguise, Location } from '../types/card'

export type LayerAsset = {
  src: string
  alt: string
  className: string
}

export const backgroundAssets: Record<Location, string> = {
  Beach: '/assets/cards/backgrounds/beach.webp',
  Moon: '/assets/cards/backgrounds/moon.webp',
  Castle: '/assets/cards/backgrounds/castle.webp',
  Forest: '/assets/cards/backgrounds/forest.webp',
  Museum: '/assets/cards/backgrounds/museum.webp',
  Kitchen: '/assets/cards/backgrounds/kitchen.webp',
  Volcano: '/assets/cards/backgrounds/volcano.webp',
  Library: '/assets/cards/backgrounds/library.webp',
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
    src: '/assets/cards/animals/fox.png',
    alt: 'Fox character',
    className: 'left-[13%] top-[28%] w-[74%]',
  },
  Dog: {
    src: '/assets/cards/animals/dog.png',
    alt: 'Dog character',
    className: 'left-[13%] top-[29%] w-[74%]',
  },
  Cat: {
    src: '/assets/cards/animals/cat.png',
    alt: 'Cat character',
    className: 'left-[14%] top-[29%] w-[72%]',
  },
  Bear: {
    src: '/assets/cards/animals/bear.png',
    alt: 'Bear character',
    className: 'left-[10%] top-[27%] w-[80%]',
  },
  Rabbit: {
    src: '/assets/cards/animals/rabbit.png',
    alt: 'Rabbit character',
    className: 'left-[13%] top-[24%] w-[74%]',
  },
  Penguin: {
    src: '/assets/cards/animals/penguin.png',
    alt: 'Penguin character',
    className: 'left-[15%] top-[30%] w-[70%]',
  },
  Lizard: {
    src: '/assets/cards/animals/lizard.png',
    alt: 'Lizard character',
    className: 'left-[9%] top-[34%] w-[82%]',
  },
  Owl: {
    src: '/assets/cards/animals/owl.png',
    alt: 'Owl character',
    className: 'left-[13%] top-[27%] w-[74%]',
  },
}

export const accessoryAssets: Record<Disguise, LayerAsset> = {
  Pirate: {
    src: '/assets/cards/accessories/pirate.png',
    alt: 'Pirate accessory',
    className: 'left-[16%] top-[20%] w-[68%]',
  },
  Astronaut: {
    src: '/assets/cards/accessories/astronaut.png',
    alt: 'Astronaut accessory',
    className: 'left-[6%] top-[17%] w-[88%]',
  },
  Wizard: {
    src: '/assets/cards/accessories/wizard.png',
    alt: 'Wizard accessory',
    className: 'left-[15%] top-[9%] w-[70%]',
  },
  Detective: {
    src: '/assets/cards/accessories/detective.png',
    alt: 'Detective accessory',
    className: 'left-[13%] top-[17%] w-[74%]',
  },
  Knight: {
    src: '/assets/cards/accessories/knight.png',
    alt: 'Knight accessory',
    className: 'left-[8%] top-[18%] w-[84%]',
  },
  Chef: {
    src: '/assets/cards/accessories/chef.png',
    alt: 'Chef accessory',
    className: 'left-[14%] top-[12%] w-[72%]',
  },
  Robot: {
    src: '/assets/cards/accessories/robot.png',
    alt: 'Robot accessory',
    className: 'left-[9%] top-[20%] w-[82%]',
  },
  Ninja: {
    src: '/assets/cards/accessories/ninja.png',
    alt: 'Ninja accessory',
    className: 'left-[8%] top-[19%] w-[84%]',
  },
}
EOF

cat > src/components/game/LayeredCardArt.tsx <<'EOF'
import type { Card } from '../../types/card'
import {
  accessoryAssets,
  animalAssets,
  backgroundAssets,
  backgroundFallbacks,
} from '../../game/cardAssets'

type LayeredCardArtProps = {
  card: Card
}

function hideBrokenImage(event: React.SyntheticEvent<HTMLImageElement>) {
  event.currentTarget.style.display = 'none'
}

export function LayeredCardArt({ card }: LayeredCardArtProps) {
  const animal = animalAssets[card.animal]
  const accessory = accessoryAssets[card.disguise]
  const background = backgroundAssets[card.location]
  const fallback = backgroundFallbacks[card.location]

  return (
    <div
      className="relative h-full w-full overflow-hidden bg-cover bg-center"
      style={{
        backgroundImage: `url(${background}), ${fallback}`,
      }}
      aria-label={`${card.animal} dressed as ${card.disguise} at ${card.location}`}
      role="img"
    >
      <div className="absolute inset-0 bg-gradient-to-b from-white/10 via-transparent to-slate-950/40" />

      <div className="absolute left-[7%] top-[8%] rounded-full bg-slate-950/55 px-3 py-1 text-xs font-black uppercase tracking-[0.22em] text-white shadow">
        {card.location}
      </div>

      <img
        src={animal.src}
        alt={animal.alt}
        className={`absolute object-contain drop-shadow-2xl ${animal.className}`}
        draggable={false}
        onError={hideBrokenImage}
      />

      <img
        src={accessory.src}
        alt={accessory.alt}
        className={`absolute object-contain drop-shadow-xl ${accessory.className}`}
        draggable={false}
        onError={hideBrokenImage}
      />

      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-slate-950 via-slate-950/88 to-transparent px-4 pb-4 pt-14">
        <p className="text-xl font-black leading-none text-white drop-shadow">
          {card.animal}
        </p>
        <p className="mt-1 text-sm font-bold text-cyan-200 drop-shadow">
          {card.disguise}
        </p>
      </div>

      <div className="pointer-events-none absolute inset-2 rounded-2xl border border-white/25" />
    </div>
  )
}
EOF

cat > src/components/game/CardView.tsx <<'EOF'
import type { Card } from '../../types/card'
import { LayeredCardArt } from './LayeredCardArt'

type CardViewProps = {
  card: Card
  label?: string
}

export function CardView({ card, label }: CardViewProps) {
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
          <p className="font-bold text-slate-500">Disguise</p>
          <p className="mt-1 font-black text-slate-100">{card.disguise}</p>
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

npm run check

echo ""
echo "Layered card asset system complete."
echo ""
echo "Asset folders:"
echo "public/assets/cards/backgrounds"
echo "public/assets/cards/animals"
echo "public/assets/cards/accessories"
echo ""
echo "Read asset plan:"
echo "public/assets/cards/README.md"
echo ""
echo "Run: npm run dev"
