#!/usr/bin/env zsh
set -e

cd ~/deduction-game

python3 - <<'PY'
from pathlib import Path

path = Path("src/game/cardAssets.ts")
text = path.read_text()

replacements = {
    "/assets/cards/animals/fox.png": "/assets/cards/animals/aml1.png",
    "/assets/cards/animals/dog.png": "/assets/cards/animals/aml2.png",
    "/assets/cards/animals/cat.png": "/assets/cards/animals/aml3.png",
    "/assets/cards/animals/bear.png": "/assets/cards/animals/aml4.png",
    "/assets/cards/animals/rabbit.png": "/assets/cards/animals/aml5.png",
    "/assets/cards/animals/penguin.png": "/assets/cards/animals/aml6.png",
    "/assets/cards/animals/lizard.png": "/assets/cards/animals/aml7.png",
    "/assets/cards/animals/owl.png": "/assets/cards/animals/aml8.png",
}

for old, new in replacements.items():
    text = text.replace(old, new)

path.write_text(text)
PY

mkdir -p public/assets/cards/animals

cat > public/assets/cards/animals/README.md <<'EOF'
# Animal image filenames

Use these exact files in this folder:

- aml1.png = Fox
- aml2.png = Dog
- aml3.png = Cat
- aml4.png = Bear
- aml5.png = Rabbit
- aml6.png = Penguin
- aml7.png = Lizard
- aml8.png = Owl

The app reads them from:

/assets/cards/animals/aml1.png
/assets/cards/animals/aml2.png
/assets/cards/animals/aml3.png
/assets/cards/animals/aml4.png
/assets/cards/animals/aml5.png
/assets/cards/animals/aml6.png
/assets/cards/animals/aml7.png
/assets/cards/animals/aml8.png
EOF

echo ""
echo "Checking animal files..."
missing=0
for file in aml1.png aml2.png aml3.png aml4.png aml5.png aml6.png aml7.png aml8.png; do
  if [ -f "public/assets/cards/animals/$file" ]; then
    echo "✓ $file"
  else
    echo "✗ missing public/assets/cards/animals/$file"
    missing=1
  fi
done

npm run check

echo ""
if [ "$missing" -eq 1 ]; then
  echo "Patch complete, but one or more animal files are missing."
  echo "Put aml1.png through aml8.png in public/assets/cards/animals/"
else
  echo "Animal mapping complete."
fi

echo "Run: npm run dev"
