#!/usr/bin/env zsh
set -e

cd ~/deduction-game

python3 - <<'PY'
import importlib.util
import subprocess
import sys

if importlib.util.find_spec("PIL") is None:
    print("Pillow not found. Installing Pillow for image cleanup...")
    subprocess.check_call([sys.executable, "-m", "pip", "install", "--user", "pillow"])
PY

python3 - <<'PY'
from collections import deque
from pathlib import Path
from PIL import Image

animal_dir = Path("public/assets/cards/animals")
files = [animal_dir / f"aml{i}.png" for i in range(1, 9)]

def is_checker_or_light_background(pixel):
    r, g, b, a = pixel

    if a == 0:
        return True

    maxc = max(r, g, b)
    minc = min(r, g, b)
    spread = maxc - minc

    # Handles baked transparent-checkerboard whites/grays.
    if minc >= 205 and spread <= 35:
        return True

    # Handles very pale off-white antialiasing.
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

    # Clean isolated checkerboard pixels that are not connected due to thin gaps.
    # Only remove light neutral pixels with at least one transparent neighbor.
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

missing = []
processed = []

for file in files:
    if not file.exists():
        missing.append(str(file))
        continue

    backup = file.with_suffix(".original.png")
    if not backup.exists():
        backup.write_bytes(file.read_bytes())

    img = Image.open(file)
    cleaned = remove_edge_connected_background(img)
    cleaned.save(file)
    processed.append(str(file))

print("")
print("Processed animal images:")
for item in processed:
    print(f"✓ {item}")

if missing:
    print("")
    print("Missing animal images:")
    for item in missing:
        print(f"✗ {item}")
PY

npm run check

echo ""
echo "Animal background cleanup complete."
echo "Run: npm run dev"
echo ""
echo "Backups were saved as aml1.original.png through aml8.original.png."
