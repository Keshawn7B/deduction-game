#!/usr/bin/env zsh
set -e

cd ~/deduction-game

python3 - <<'PY'
from pathlib import Path

path = Path("src/game/cardAssets.ts")
text = path.read_text()

old = """export const backgroundAssets: Record<Location, string> = {
  Beach: '/assets/cards/backgrounds/beach.webp',
  Moon: '/assets/cards/backgrounds/moon.webp',
  Castle: '/assets/cards/backgrounds/castle.webp',
  Forest: '/assets/cards/backgrounds/forest.webp',
  Museum: '/assets/cards/backgrounds/museum.webp',
  Kitchen: '/assets/cards/backgrounds/kitchen.webp',
  Volcano: '/assets/cards/backgrounds/volcano.webp',
  Library: '/assets/cards/backgrounds/library.webp',
}"""

new = """export const backgroundAssets: Record<Location, string> = {
  Beach: '/assets/cards/backgrounds/bkg1.png',
  Moon: '/assets/cards/backgrounds/bkg2.png',
  Castle: '/assets/cards/backgrounds/bkg3.png',
  Forest: '/assets/cards/backgrounds/bkg4.png',
  Museum: '/assets/cards/backgrounds/bkg5.png',
  Kitchen: '/assets/cards/backgrounds/bkg6.png',
  Volcano: '/assets/cards/backgrounds/bkg7.png',
  Library: '/assets/cards/backgrounds/bkg8.png',
}"""

if old not in text:
    start = text.find("export const backgroundAssets")
    end = text.find("\n\nexport const backgroundFallbacks", start)
    if start == -1 or end == -1:
      raise SystemExit("Could not find backgroundAssets block in src/game/cardAssets.ts")
    text = text[:start] + new + text[end:]
else:
    text = text.replace(old, new)

path.write_text(text)
PY

cat > public/assets/cards/backgrounds/README.md <<'EOF'
# Background image filenames

Use these exact files in this folder:

- bkg1.png = Beach
- bkg2.png = Moon
- bkg3.png = Castle
- bkg4.png = Forest
- bkg5.png = Museum
- bkg6.png = Kitchen
- bkg7.png = Volcano
- bkg8.png = Library

The app reads them from:

/assets/cards/backgrounds/bkg1.png
/assets/cards/backgrounds/bkg2.png
/assets/cards/backgrounds/bkg3.png
/assets/cards/backgrounds/bkg4.png
/assets/cards/backgrounds/bkg5.png
/assets/cards/backgrounds/bkg6.png
/assets/cards/backgrounds/bkg7.png
/assets/cards/backgrounds/bkg8.png
EOF

echo ""
echo "Checking background files..."
missing=0
for file in bkg1.png bkg2.png bkg3.png bkg4.png bkg5.png bkg6.png bkg7.png bkg8.png; do
  if [ -f "public/assets/cards/backgrounds/$file" ]; then
    echo "✓ $file"
  else
    echo "✗ missing public/assets/cards/backgrounds/$file"
    missing=1
  fi
done

npm run check

echo ""
if [ "$missing" -eq 1 ]; then
  echo "Patch complete, but one or more background files are missing."
  echo "Put bkg1.png through bkg8.png in public/assets/cards/backgrounds/"
else
  echo "Background mapping complete."
fi

echo "Run: npm run dev"
