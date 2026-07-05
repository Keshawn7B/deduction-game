#!/usr/bin/env zsh
set -e

cd ~/deduction-game

python3 - <<'PY'
from pathlib import Path

game_page = Path("src/pages/GamePage.tsx")
text = game_page.read_text()

bad_block = """  useEffect(() => {
    setSelectedCardId('')
  }, [room?.currentTurnPlayerId])

"""

if bad_block in text:
    text = text.replace(bad_block, "")
else:
    print("Note: turn-change selected-card reset block was not found. Skipping that removal.")

game_page.write_text(text)
PY

cat > eslint.config.js <<'EOF'
import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  { ignores: ['dist'] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': [
        'warn',
        {
          allowConstantExport: true,
          allowExportNames: ['useAuth'],
        },
      ],
    },
  },
)
EOF

npm run check

echo ""
echo "Lint fix complete."
echo "Run: npm run dev"
