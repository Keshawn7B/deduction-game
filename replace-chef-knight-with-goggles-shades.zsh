#!/usr/bin/env zsh
set -e

cd ~/deduction-game

cat > src/types/card.ts <<'EOF'
export type Animal =
  | 'Fox'
  | 'Dog'
  | 'Cat'
  | 'Bear'
  | 'Rabbit'
  | 'Penguin'
  | 'Lizard'
  | 'Owl'

export type Accessory =
  | 'Pirate'
  | 'Wizard'
  | 'Detective'
  | 'Crown'
  | 'Goggles'
  | 'Aviator'
  | 'Shades'
  | 'Explorer'

export type Disguise = Accessory

export type Location =
  | 'Beach'
  | 'Moon'
  | 'Castle'
  | 'Forest'
  | 'Museum'
  | 'Kitchen'
  | 'Volcano'
  | 'Library'

export type Card = {
  id: string
  animal: Animal
  disguise: Disguise
  location: Location
}

export type Guess = {
  animal: Animal
  disguise: Disguise
  location: Location
}

export type ClueResult = 'YES' | 'NO'
EOF

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
  'Goggles',
  'Aviator',
  'Shades',
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
  Goggles: {
    src: '/assets/cards/accessories/acc5.png',
    alt: 'Goggles accessory',
    className: 'left-[9%] top-[20%] h-[22%] w-[82%]',
  },
  Aviator: {
    src: '/assets/cards/accessories/acc6.png',
    alt: 'Aviator accessory',
    className: 'left-[3%] top-[20%] h-[36%] w-[94%]',
  },
  Shades: {
    src: '/assets/cards/accessories/acc7.png',
    alt: 'Shades accessory',
    className: 'left-[13%] top-[23%] h-[16%] w-[74%]',
  },
  Explorer: {
    src: '/assets/cards/accessories/acc8.png',
    alt: 'Explorer accessory',
    className: 'left-[4%] top-[8%] h-[34%] w-[92%]',
  },
}

const legacyAccessoryMap: Record<string, Disguise> = {
  Astronaut: 'Aviator',
  Robot: 'Shades',
  Ninja: 'Explorer',
  Chef: 'Goggles',
  Knight: 'Shades',
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

cat > public/assets/cards/accessories/README.md <<'EOF'
# Accessory image filenames

Use these exact files in this folder:

- acc1.png = Pirate
- acc2.png = Wizard
- acc3.png = Detective
- acc4.png = Crown
- acc5.png = Goggles
- acc6.png = Aviator
- acc7.png = Shades
- acc8.png = Explorer

The app reads them from:

/assets/cards/accessories/acc1.png
/assets/cards/accessories/acc2.png
/assets/cards/accessories/acc3.png
/assets/cards/accessories/acc4.png
/assets/cards/accessories/acc5.png
/assets/cards/accessories/acc6.png
/assets/cards/accessories/acc7.png
/assets/cards/accessories/acc8.png
EOF

echo ""
echo "Checking for remaining Chef/Knight accessory references..."
if command -v rg >/dev/null 2>&1; then
  rg -n "'Chef'|'Knight'|\\bChef\\b|\\bKnight\\b" src || true
else
  grep -RInE "'Chef'|'Knight'|\\bChef\\b|\\bKnight\\b" src || true
fi

npm run check

echo ""
echo "Accessory replacement complete."
echo "Now:"
echo "acc5.png = Goggles"
echo "acc7.png = Shades"
echo ""
echo "Legacy compatibility:"
echo "Chef -> Goggles"
echo "Knight -> Shades"
echo ""
echo "Run: npm run dev"
