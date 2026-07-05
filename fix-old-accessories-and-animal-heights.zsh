#!/usr/bin/env zsh
set -e

cd ~/deduction-game

cat > src/game/deck.ts <<'EOF'
import type { Animal, Card, Disguise, Location } from '../types/card'

export const ANIMALS: Animal[] = [
  'Fox',
  'Dog',
  'Cat',
  'Bear',
  'Rabbit',
  'Penguin',
  'Lizard',
  'Owl',
]

export const DISGUISES: Disguise[] = [
  'Pirate',
  'Wizard',
  'Detective',
  'Crown',
  'Chef',
  'Aviator',
  'Knight',
  'Explorer',
]

export const LOCATIONS: Location[] = [
  'Beach',
  'Moon',
  'Castle',
  'Forest',
  'Museum',
  'Kitchen',
  'Volcano',
  'Library',
]

export function createDeck(): Card[] {
  const cards: Card[] = []

  for (const animal of ANIMALS) {
    for (const disguise of DISGUISES) {
      for (const location of LOCATIONS) {
        cards.push({
          id: `${animal}-${disguise}-${location}`,
          animal,
          disguise,
          location,
        })
      }
    }
  }

  return cards
}

export function shuffleDeck(cards: Card[], random = Math.random): Card[] {
  const shuffledCards = [...cards]

  for (let index = shuffledCards.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1))
    const currentCard = shuffledCards[index]
    const swapCard = shuffledCards[swapIndex]

    shuffledCards[index] = swapCard
    shuffledCards[swapIndex] = currentCard
  }

  return shuffledCards
}

export function drawCards(deck: Card[], count: number) {
  const drawnCards = deck.slice(0, count)

  return {
    drawnCards,
    drawn: drawnCards,
    remainingDeck: deck.slice(count),
  }
}
EOF

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
    className: 'left-[12%] top-[24%] w-[76%] h-[60%]',
  },
  Dog: {
    src: '/assets/cards/animals/aml2.png',
    alt: 'Dog portrait',
    className: 'left-[9%] top-[24%] w-[82%] h-[62%]',
  },
  Cat: {
    src: '/assets/cards/animals/aml3.png',
    alt: 'Cat portrait',
    className: 'left-[11%] top-[24%] w-[78%] h-[61%]',
  },
  Bear: {
    src: '/assets/cards/animals/aml4.png',
    alt: 'Bear portrait',
    className: 'left-[5%] top-[21%] w-[90%] h-[64%]',
  },
  Rabbit: {
    src: '/assets/cards/animals/aml5.png',
    alt: 'Rabbit portrait',
    className: 'left-[10%] top-[16%] w-[80%] h-[68%]',
  },
  Penguin: {
    src: '/assets/cards/animals/aml6.png',
    alt: 'Penguin portrait',
    className: 'left-[8%] top-[25%] w-[84%] h-[62%]',
  },
  Lizard: {
    src: '/assets/cards/animals/aml7.png',
    alt: 'Lizard portrait',
    className: 'left-[7%] top-[28%] w-[86%] h-[58%]',
  },
  Owl: {
    src: '/assets/cards/animals/aml8.png',
    alt: 'Owl portrait',
    className: 'left-[8%] top-[20%] w-[84%] h-[65%]',
  },
}

export const accessoryAssets: Record<Disguise, LayerAsset> = {
  Pirate: {
    src: '/assets/cards/accessories/acc1.png',
    alt: 'Pirate accessory',
    className: 'left-[2%] top-[2%] w-[96%] h-[40%]',
  },
  Wizard: {
    src: '/assets/cards/accessories/acc2.png',
    alt: 'Wizard accessory',
    className: 'left-[6%] top-[-2%] w-[88%] h-[44%]',
  },
  Detective: {
    src: '/assets/cards/accessories/acc3.png',
    alt: 'Detective accessory',
    className: 'left-[8%] top-[8%] w-[84%] h-[34%]',
  },
  Crown: {
    src: '/assets/cards/accessories/acc4.png',
    alt: 'Crown accessory',
    className: 'left-[10%] top-[8%] w-[80%] h-[26%]',
  },
  Chef: {
    src: '/assets/cards/accessories/acc5.png',
    alt: 'Chef accessory',
    className: 'left-[5%] top-[0%] w-[90%] h-[34%]',
  },
  Aviator: {
    src: '/assets/cards/accessories/acc6.png',
    alt: 'Aviator accessory',
    className: 'left-[3%] top-[20%] w-[94%] h-[36%]',
  },
  Knight: {
    src: '/assets/cards/accessories/acc7.png',
    alt: 'Knight accessory',
    className: 'left-[7%] top-[13%] w-[86%] h-[44%]',
  },
  Explorer: {
    src: '/assets/cards/accessories/acc8.png',
    alt: 'Explorer accessory',
    className: 'left-[4%] top-[8%] w-[92%] h-[34%]',
  },
}
EOF

cat > src/components/game/CardArt.tsx <<'EOF'
import type { Animal, Card, Disguise, Location } from '../../types/card'
import { LayeredCardArt } from './LayeredCardArt'

type CardArtProps = {
  animal: Animal
  disguise: Disguise
  location: Location
}

export function CardArt({ animal, disguise, location }: CardArtProps) {
  const card: Card = {
    id: `${animal}-${disguise}-${location}`,
    animal,
    disguise,
    location,
  }

  return <LayeredCardArt card={card} />
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
      aria-label={`${card.animal} wearing ${card.disguise} at ${card.location}`}
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
          {card.disguise}
        </p>
      </div>

      <div className="pointer-events-none absolute inset-2 rounded-2xl border border-white/25" />
    </div>
  )
}
EOF

python3 - <<'PY'
from pathlib import Path

setup = Path("src/game/setup.ts")
if setup.exists():
    text = setup.read_text()
    text = text.replace("identityDraw.drawn[0]", "identityDraw.drawnCards[0]")
    text = text.replace("handDraw.drawn,", "handDraw.drawnCards,")
    setup.write_text(text)
PY

echo ""
echo "Searching for old accessory references..."
if command -v rg >/dev/null 2>&1; then
  rg -n "Astronaut|Robot|Ninja" src || true
else
  grep -RInE "Astronaut|Robot|Ninja" src || true
fi

npm run check

echo ""
echo "Old accessory references were cleaned and animal heights were adjusted."
echo "If a specific animal is still too tall/short, tell me which one and I can tune just that one."
echo "Run: npm run dev"
