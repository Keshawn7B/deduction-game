#!/usr/bin/env zsh
set -e

cd ~/deduction-game

python3 - <<'PY'
from pathlib import Path

path = Path("src/pages/LobbyPage.tsx")
text = path.read_text()

text = text.replace(
    "import { useEffect, useMemo, useState } from 'react'",
    "import { useEffect, useMemo, useRef, useState } from 'react'",
)

text = text.replace(
    "  const [wasJoined, setWasJoined] = useState(false)\n",
    "  const wasJoinedRef = useRef(false)\n",
)

old_effect = """  useEffect(() => {
    if (currentPlayer) {
      setWasJoined(true)
      return
    }

    if (wasJoined && room?.status === 'lobby') {
      navigate('/')
    }
  }, [currentPlayer, navigate, room?.status, wasJoined])

"""

new_effect = """  useEffect(() => {
    if (currentPlayer) {
      wasJoinedRef.current = true
      return
    }

    if (wasJoinedRef.current && room?.status === 'lobby') {
      navigate('/')
    }
  }, [currentPlayer, navigate, room?.status])

"""

if old_effect in text:
    text = text.replace(old_effect, new_effect)
elif "setWasJoined(true)" in text:
    raise SystemExit("Found setWasJoined, but exact effect block did not match.")
else:
    print("No setWasJoined effect found. Skipping LobbyPage effect patch.")

path.write_text(text)
PY

mkdir -p public/assets/cards/backgrounds

echo ""
echo "Trying to locate bkg1.png through bkg8.png..."
for file in bkg1.png bkg2.png bkg3.png bkg4.png bkg5.png bkg6.png bkg7.png bkg8.png; do
  target="public/assets/cards/backgrounds/$file"

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
    echo "✗ still missing $file"
  fi
done

echo ""
echo "Final background file check:"
missing=0
for file in bkg1.png bkg2.png bkg3.png bkg4.png bkg5.png bkg6.png bkg7.png bkg8.png; do
  if [ -f "public/assets/cards/backgrounds/$file" ]; then
    echo "✓ public/assets/cards/backgrounds/$file"
  else
    echo "✗ public/assets/cards/backgrounds/$file"
    missing=1
  fi
done

npm run check

echo ""
if [ "$missing" -eq 1 ]; then
  echo "Lint is fixed, but some background image files are still missing."
  echo "Move bkg1.png through bkg8.png into:"
  echo "public/assets/cards/backgrounds/"
else
  echo "Lobby lint and background files are fixed."
fi

echo "Run: npm run dev"
