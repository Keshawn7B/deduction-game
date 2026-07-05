#!/usr/bin/env zsh
set -e

cd ~/deduction-game

python3 - <<'PY'
from pathlib import Path

path = Path("src/game/cardAssets.ts")
text = path.read_text()

old = """  Shades: {
    src: '/assets/cards/accessories/acc7.png',
    alt: 'Shades accessory',
    className: 'left-[-2%] top-[40%] h-[24%] w-[104%]',
  },"""

new = """  Shades: {
    src: '/assets/cards/accessories/acc7.png',
    alt: 'Shades accessory',
    className: 'left-[1%] top-[40%] h-[24%] w-[104%]',
  },"""

if old not in text:
    raise SystemExit("Could not find the Shades block with left-[-2%]. Check src/game/cardAssets.ts.")

text = text.replace(old, new, 1)
path.write_text(text)
PY

npm run check

echo ""
echo "Shades moved slightly right."
echo "Changed left from -2% to 1%."
echo "Run: npm run dev"
