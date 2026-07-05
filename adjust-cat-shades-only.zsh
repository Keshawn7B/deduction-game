#!/usr/bin/env zsh
set -e

cd ~/deduction-game

python3 - <<'PY'
from pathlib import Path

path = Path("src/game/cardAssets.ts")
text = path.read_text()

if "export const accessoryPositionOverrides" not in text:
    insert_after = """export const accessoryAssets: Record<Disguise, LayerAsset> = {"""
    # We insert the overrides after the accessoryAssets object, so find after legacy map marker.
    marker = """const legacyAccessoryMap: Record<string, Disguise> = {"""
    overrides = """export const accessoryPositionOverrides: Partial<
  Record<Animal, Partial<Record<Disguise, string>>>
> = {
  Cat: {
    Shades: 'left-[3%] top-[43%] h-[24%] w-[104%]',
  },
}

"""
    if marker not in text:
        raise SystemExit("Could not find legacyAccessoryMap marker in src/game/cardAssets.ts")

    text = text.replace(marker, overrides + marker, 1)

old_fn = """export function getAccessoryAsset(value: string): LayerAsset {
  return accessoryAssets[normalizeAccessory(value)]
}
"""

new_fn = """export function getAccessoryAsset(
  value: string,
  animal?: Animal,
): LayerAsset {
  const accessoryName = normalizeAccessory(value)
  const asset = accessoryAssets[accessoryName]
  const overrideClassName = animal
    ? accessoryPositionOverrides[animal]?.[accessoryName]
    : undefined

  return {
    ...asset,
    className: overrideClassName ?? asset.className,
  }
}
"""

if old_fn in text:
    text = text.replace(old_fn, new_fn, 1)
elif "export function getAccessoryAsset(" in text and "animal?: Animal" not in text:
    raise SystemExit("getAccessoryAsset exists but did not match expected block.")

path.write_text(text)
PY

python3 - <<'PY'
from pathlib import Path

path = Path("src/components/game/LayeredCardArt.tsx")
text = path.read_text()

text = text.replace(
    "  const accessory = getAccessoryAsset(card.disguise)\n",
    "  const accessory = getAccessoryAsset(card.disguise, card.animal)\n",
)

path.write_text(text)
PY

npm run check

echo ""
echo "Cat-only shades override added."
echo "Only Cat + Shades changed:"
echo "left 1% -> 3%"
echo "top 40% -> 43%"
echo "size stays the same"
echo ""
echo "Run: npm run dev"
