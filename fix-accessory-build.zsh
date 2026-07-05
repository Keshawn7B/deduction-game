#!/usr/bin/env zsh
set -e

cd ~/deduction-game

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

python3 - <<'PY'
from pathlib import Path

deck = Path("src/game/deck.ts")
text = deck.read_text()

old = """export function drawCards(deck: Card[], count: number) {
  return {
    drawnCards: deck.slice(0, count),
    remainingDeck: deck.slice(count),
  }
}
"""

new = """export function drawCards(deck: Card[], count: number) {
  const drawnCards = deck.slice(0, count)

  return {
    drawnCards,
    drawn: drawnCards,
    remainingDeck: deck.slice(count),
  }
}
"""

if old in text:
    text = text.replace(old, new)
else:
    print("drawCards block did not match exactly. Leaving deck.ts as-is.")

deck.write_text(text)
PY

python3 - <<'PY'
from pathlib import Path

setup = Path("src/game/setup.ts")
text = setup.read_text()

text = text.replace("identityDraw.drawn[0]", "identityDraw.drawnCards[0]")
text = text.replace("handDraw.drawn,", "handDraw.drawnCards,")

setup.write_text(text)
PY

npm run check

echo ""
echo "Accessory build fix complete."
echo "Run: npm run dev"
