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
  | 'Chef'
  | 'Aviator'
  | 'Knight'
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
  return {
    drawnCards: deck.slice(0, count),
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
    className: 'left-[12%] top-[26%] w-[76%]',
  },
  Dog: {
    src: '/assets/cards/animals/aml2.png',
    alt: 'Dog portrait',
    className: 'left-[9%] top-[26%] w-[82%]',
  },
  Cat: {
    src: '/assets/cards/animals/aml3.png',
    alt: 'Cat portrait',
    className: 'left-[11%] top-[25%] w-[78%]',
  },
  Bear: {
    src: '/assets/cards/animals/aml4.png',
    alt: 'Bear portrait',
    className: 'left-[4%] top-[24%] w-[92%]',
  },
  Rabbit: {
    src: '/assets/cards/animals/aml5.png',
    alt: 'Rabbit portrait',
    className: 'left-[10%] top-[18%] w-[80%]',
  },
  Penguin: {
    src: '/assets/cards/animals/aml6.png',
    alt: 'Penguin portrait',
    className: 'left-[8%] top-[28%] w-[84%]',
  },
  Lizard: {
    src: '/assets/cards/animals/aml7.png',
    alt: 'Lizard portrait',
    className: 'left-[7%] top-[30%] w-[86%]',
  },
  Owl: {
    src: '/assets/cards/animals/aml8.png',
    alt: 'Owl portrait',
    className: 'left-[8%] top-[22%] w-[84%]',
  },
}

export const accessoryAssets: Record<Disguise, LayerAsset> = {
  Pirate: {
    src: '/assets/cards/accessories/acc1.png',
    alt: 'Pirate hat accessory',
    className: 'left-[2%] top-[2%] w-[96%]',
  },
  Wizard: {
    src: '/assets/cards/accessories/acc2.png',
    alt: 'Wizard hat accessory',
    className: 'left-[6%] top-[-2%] w-[88%]',
  },
  Detective: {
    src: '/assets/cards/accessories/acc3.png',
    alt: 'Detective hat accessory',
    className: 'left-[8%] top-[10%] w-[84%]',
  },
  Crown: {
    src: '/assets/cards/accessories/acc4.png',
    alt: 'Crown accessory',
    className: 'left-[10%] top-[8%] w-[80%]',
  },
  Chef: {
    src: '/assets/cards/accessories/acc5.png',
    alt: 'Chef hat accessory',
    className: 'left-[5%] top-[0%] w-[90%]',
  },
  Aviator: {
    src: '/assets/cards/accessories/acc6.png',
    alt: 'Aviator goggles and scarf accessory',
    className: 'left-[3%] top-[20%] w-[94%]',
  },
  Knight: {
    src: '/assets/cards/accessories/acc7.png',
    alt: 'Knight collar accessory',
    className: 'left-[7%] top-[13%] w-[86%]',
  },
  Explorer: {
    src: '/assets/cards/accessories/acc8.png',
    alt: 'Explorer hat accessory',
    className: 'left-[4%] top-[8%] w-[92%]',
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
  const accessory = accessoryAssets[card.disguise] ?? accessoryAssets.Pirate
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
          <p className="font-bold text-slate-500">Accessory</p>
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

mkdir -p public/assets/cards/accessories

cat > public/assets/cards/accessories/README.md <<'EOF'
# Accessory image filenames

Use these exact files in this folder:

- acc1.png = Pirate
- acc2.png = Wizard
- acc3.png = Detective
- acc4.png = Crown
- acc5.png = Chef
- acc6.png = Aviator
- acc7.png = Knight
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

python3 - <<'PY'
import importlib.util
import subprocess
import sys

if importlib.util.find_spec("PIL") is None:
    print("Pillow not found. Installing Pillow for image cleanup...")
    subprocess.check_call([sys.executable, "-m", "pip", "install", "--user", "pillow"])
PY

echo ""
echo "Trying to locate acc1.png through acc8.png..."
for file in acc1.png acc2.png acc3.png acc4.png acc5.png acc6.png acc7.png acc8.png; do
  target="public/assets/cards/accessories/$file"

  if [ -f "$target" ]; then
    echo "✓ already in place: $target"
    continue
  fi

  found=""
  for base in "$PWD" "$HOME/Downloads" "$HOME/Pictures" "$HOME/Desktop"; do
    if [ -d "$base" ]; then
      found=$(find "$base" -maxdepth 3 -type f -name "$file" 2>/dev/null | head -n 1 || true)
      if [ -n "$found" ]; then
        break
      fi
    fi
  done

  if [ -n "$found" ]; then
    cp "$found" "$target"
    echo "✓ copied $file from $found"
  else
    echo "✗ missing $file"
  fi
done

python3 - <<'PY'
from collections import deque
from pathlib import Path
from PIL import Image

accessory_dir = Path("public/assets/cards/accessories")
files = [accessory_dir / f"acc{i}.png" for i in range(1, 9)]

def is_checker_or_light_background(pixel):
    r, g, b, a = pixel

    if a == 0:
        return True

    maxc = max(r, g, b)
    minc = min(r, g, b)
    spread = maxc - minc

    if minc >= 205 and spread <= 35:
        return True

    if minc >= 220 and spread <= 55:
        return True

    return False

def remove_edge_connected_background(img):
    img = img.convert("RGBA")
    width, height = img.size
    px = img.load()

    visited = set()
    queue = deque()

    for x in range(width):
        queue.append((x, 0))
        queue.append((x, height - 1))

    for y in range(height):
        queue.append((0, y))
        queue.append((width - 1, y))

    while queue:
        x, y = queue.popleft()

        if (x, y) in visited:
            continue

        if x < 0 or y < 0 or x >= width or y >= height:
            continue

        visited.add((x, y))

        if not is_checker_or_light_background(px[x, y]):
            continue

        r, g, b, a = px[x, y]
        px[x, y] = (r, g, b, 0)

        queue.append((x + 1, y))
        queue.append((x - 1, y))
        queue.append((x, y + 1))
        queue.append((x, y - 1))

    changed = True
    passes = 0

    while changed and passes < 3:
        changed = False
        passes += 1
        to_clear = []

        for y in range(height):
            for x in range(width):
                r, g, b, a = px[x, y]
                if a == 0:
                    continue

                if not is_checker_or_light_background((r, g, b, a)):
                    continue

                neighbors = [
                    (x + 1, y),
                    (x - 1, y),
                    (x, y + 1),
                    (x, y - 1),
                ]

                if any(
                    0 <= nx < width
                    and 0 <= ny < height
                    and px[nx, ny][3] == 0
                    for nx, ny in neighbors
                ):
                    to_clear.append((x, y))

        for x, y in to_clear:
            r, g, b, a = px[x, y]
            px[x, y] = (r, g, b, 0)
            changed = True

    return img

processed = []
missing = []

for file in files:
    if not file.exists():
        missing.append(str(file))
        continue

    backup = file.with_suffix(".original.png")
    if not backup.exists():
        backup.write_bytes(file.read_bytes())

    cleaned = remove_edge_connected_background(Image.open(file))
    cleaned.save(file)
    processed.append(str(file))

print("")
print("Processed accessory images:")
for item in processed:
    print(f"✓ {item}")

if missing:
    print("")
    print("Missing accessory images:")
    for item in missing:
        print(f"✗ {item}")
PY

echo ""
echo "Final accessory file check:"
missing=0
for file in acc1.png acc2.png acc3.png acc4.png acc5.png acc6.png acc7.png acc8.png; do
  if [ -f "public/assets/cards/accessories/$file" ]; then
    echo "✓ public/assets/cards/accessories/$file"
  else
    echo "✗ public/assets/cards/accessories/$file"
    missing=1
  fi
done

npm run check

echo ""
if [ "$missing" -eq 1 ]; then
  echo "Patch complete, but one or more accessory files are missing."
  echo "Put acc1.png through acc8.png in public/assets/cards/accessories/"
else
  echo "Accessory mapping complete."
fi

echo "Run: npm run dev"
