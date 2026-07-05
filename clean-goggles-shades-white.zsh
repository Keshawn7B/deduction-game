#!/usr/bin/env zsh
set -e

cd ~/deduction-game

python3 - <<'PY'
import importlib.util
import subprocess
import sys

if importlib.util.find_spec("PIL") is None:
    print("Pillow not found. Installing Pillow...")
    subprocess.check_call([sys.executable, "-m", "pip", "install", "--user", "pillow"])
PY

python3 - <<'PY'
from collections import deque
from pathlib import Path
from PIL import Image

FILES = [
    Path("public/assets/cards/accessories/acc5.png"),  # Goggles
    Path("public/assets/cards/accessories/acc7.png"),  # Shades
]

CANVAS_SIZE = 1024
TARGET_WIDTH_RATIO = 0.92
PADDING = 24

def is_white_or_checker(pixel):
    r, g, b, a = pixel

    if a == 0:
        return True

    maxc = max(r, g, b)
    minc = min(r, g, b)
    spread = maxc - minc

    # Pure white / off-white background
    if minc >= 230 and spread <= 45:
        return True

    # Baked checkerboard: pale neutral whites/grays
    if minc >= 205 and spread <= 35:
        return True

    # Light gray backgrounds
    if minc >= 190 and spread <= 25:
        return True

    return False

def flood_clear_background(img):
    img = img.convert("RGBA")
    width, height = img.size
    px = img.load()

    queue = deque()
    visited = set()

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

        if not is_white_or_checker(px[x, y]):
            continue

        r, g, b, a = px[x, y]
        px[x, y] = (r, g, b, 0)

        queue.append((x + 1, y))
        queue.append((x - 1, y))
        queue.append((x, y + 1))
        queue.append((x, y - 1))

    # Expand transparency inward a little to remove halo/checker leftovers.
    for _ in range(4):
        to_clear = []

        for y in range(height):
            for x in range(width):
                r, g, b, a = px[x, y]
                if a == 0:
                    continue

                if not is_white_or_checker((r, g, b, a)):
                    continue

                neighbors = [
                    (x + 1, y),
                    (x - 1, y),
                    (x, y + 1),
                    (x, y - 1),
                    (x + 1, y + 1),
                    (x - 1, y - 1),
                    (x + 1, y - 1),
                    (x - 1, y + 1),
                ]

                if any(
                    0 <= nx < width
                    and 0 <= ny < height
                    and px[nx, ny][3] == 0
                    for nx, ny in neighbors
                ):
                    to_clear.append((x, y))

        if not to_clear:
            break

        for x, y in to_clear:
            r, g, b, a = px[x, y]
            px[x, y] = (r, g, b, 0)

    return img

def crop_and_center(img):
    alpha = img.getchannel("A")
    bbox = alpha.getbbox()

    if not bbox:
        return img

    cropped = img.crop(bbox)
    crop_w, crop_h = cropped.size

    target_w = int(CANVAS_SIZE * TARGET_WIDTH_RATIO)
    target_h = CANVAS_SIZE - (PADDING * 2)

    scale = min(target_w / crop_w, target_h / crop_h)
    new_w = max(1, int(crop_w * scale))
    new_h = max(1, int(crop_h * scale))

    resized = cropped.resize((new_w, new_h), Image.Resampling.LANCZOS)

    canvas = Image.new("RGBA", (CANVAS_SIZE, CANVAS_SIZE), (0, 0, 0, 0))
    x = (CANVAS_SIZE - new_w) // 2
    y = (CANVAS_SIZE - new_h) // 2
    canvas.alpha_composite(resized, (x, y))

    return canvas

processed = []
missing = []

for path in FILES:
    if not path.exists():
        missing.append(str(path))
        continue

    backup = path.with_suffix(".before-white-clean.png")
    if not backup.exists():
        backup.write_bytes(path.read_bytes())

    img = Image.open(path)
    cleaned = flood_clear_background(img)
    fitted = crop_and_center(cleaned)
    fitted.save(path)

    processed.append(str(path))

print("")
print("Cleaned accessory files:")
for item in processed:
    print(f"✓ {item}")

if missing:
    print("")
    print("Missing accessory files:")
    for item in missing:
        print(f"✗ {item}")
PY

python3 - <<'PY'
from pathlib import Path

path = Path("src/game/cardAssets.ts")
text = path.read_text()

text = text.replace(
"""  Goggles: {
    src: '/assets/cards/accessories/acc5.png',
    alt: 'Goggles accessory',
    className: 'left-[9%] top-[20%] h-[22%] w-[82%]',
  },""",
"""  Goggles: {
    src: '/assets/cards/accessories/acc5.png',
    alt: 'Goggles accessory',
    className: 'left-[0%] top-[34%] h-[24%] w-full',
  },"""
)

text = text.replace(
"""  Shades: {
    src: '/assets/cards/accessories/acc7.png',
    alt: 'Shades accessory',
    className: 'left-[13%] top-[23%] h-[16%] w-[74%]',
  },""",
"""  Shades: {
    src: '/assets/cards/accessories/acc7.png',
    alt: 'Shades accessory',
    className: 'left-[2%] top-[36%] h-[20%] w-[96%]',
  },"""
)

path.write_text(text)
PY

npm run check

echo ""
echo "White background cleanup complete for:"
echo "acc5.png = Goggles"
echo "acc7.png = Shades"
echo ""
echo "Backups saved as:"
echo "acc5.before-white-clean.png"
echo "acc7.before-white-clean.png"
echo ""
echo "Also moved goggles/shades lower and made them larger."
echo "Run: npm run dev"
