import type { Animal, Disguise, Location } from '../types/card'

export type LayerPosition = {
  left: number
  top: number
  width: number
  height: number
}

export type LayerAsset = {
  src: string
  alt: string
  position: LayerPosition
}

const assetPath = (path: string) => `${import.meta.env.BASE_URL}${path}`

export const backgroundAssets: Record<Location, string> = {
  Beach: assetPath('assets/cards/backgrounds/bkg1.png'),
  Moon: assetPath('assets/cards/backgrounds/bkg2.png'),
  Castle: assetPath('assets/cards/backgrounds/bkg3.png'),
  Forest: assetPath('assets/cards/backgrounds/bkg4.png'),
  Museum: assetPath('assets/cards/backgrounds/bkg5.png'),
  Kitchen: assetPath('assets/cards/backgrounds/bkg6.png'),
  Volcano: assetPath('assets/cards/backgrounds/bkg7.png'),
  Library: assetPath('assets/cards/backgrounds/bkg8.png'),
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
    src: assetPath('assets/cards/animals/aml1.png'),
    alt: 'Fox portrait',
    position: { left: 12, top: 24, width: 76, height: 60 },
  },
  Dog: {
    src: assetPath('assets/cards/animals/aml2.png'),
    alt: 'Dog portrait',
    position: { left: 9, top: 24, width: 82, height: 62 },
  },
  Cat: {
    src: assetPath('assets/cards/animals/aml3.png'),
    alt: 'Cat portrait',
    position: { left: 11, top: 24, width: 78, height: 61 },
  },
  Bear: {
    src: assetPath('assets/cards/animals/aml4.png'),
    alt: 'Bear portrait',
    position: { left: 5, top: 21, width: 90, height: 64 },
  },
  Rabbit: {
    src: assetPath('assets/cards/animals/aml5.png'),
    alt: 'Rabbit portrait',
    position: { left: 10, top: 16, width: 80, height: 68 },
  },
  Penguin: {
    src: assetPath('assets/cards/animals/aml6.png'),
    alt: 'Penguin portrait',
    position: { left: 8, top: 25, width: 84, height: 62 },
  },
  Lizard: {
    src: assetPath('assets/cards/animals/aml7.png'),
    alt: 'Lizard portrait',
    position: { left: 7, top: 28, width: 86, height: 58 },
  },
  Owl: {
    src: assetPath('assets/cards/animals/aml8.png'),
    alt: 'Owl portrait',
    position: { left: 8, top: 20, width: 84, height: 65 },
  },
}

export const accessoryAssets: Record<Disguise, LayerAsset> = {
  Pirate: {
    src: assetPath('assets/cards/accessories/acc1.png'),
    alt: 'Pirate accessory',
    position: { left: 2, top: 2, width: 96, height: 40 },
  },
  Wizard: {
    src: assetPath('assets/cards/accessories/acc2.png'),
    alt: 'Wizard accessory',
    position: { left: 6, top: -2, width: 88, height: 44 },
  },
  Detective: {
    src: assetPath('assets/cards/accessories/acc3.png'),
    alt: 'Detective accessory',
    position: { left: 8, top: 8, width: 84, height: 34 },
  },
  Crown: {
    src: assetPath('assets/cards/accessories/acc4.png'),
    alt: 'Crown accessory',
    position: { left: 10, top: 8, width: 80, height: 26 },
  },
  Goggles: {
    src: assetPath('assets/cards/accessories/acc5.png'),
    alt: 'Goggles accessory',
    position: { left: 0, top: 34, width: 100, height: 24 },
  },
  Flowers: {
    src: assetPath('assets/cards/accessories/acc6.png'),
    alt: 'Flowers accessory',
    position: { left: 3, top: 10, width: 94, height: 28 },
  },
  Shades: {
    src: assetPath('assets/cards/accessories/acc7.png'),
    alt: 'Shades accessory',
    position: { left: 1, top: 40, width: 104, height: 24 },
  },
  Explorer: {
    src: assetPath('assets/cards/accessories/acc8.png'),
    alt: 'Explorer accessory',
    position: { left: 4, top: 8, width: 92, height: 34 },
  },
}

/*
Edit all 64 accessory positions here.

Format:
left = horizontal position in percent
top = vertical position in percent
width = accessory width in percent
height = accessory height in percent

Easiest visual editor:
1. Run `npm run dev`.
2. Open `http://127.0.0.1:5173/#/accessory-editor`.
3. Pick an animal + accessory.
4. Use the sliders until it looks right.
5. Copy the generated line back into this table.

Examples:
- Move right: left: 1 -> left: 4
- Move left: left: 1 -> left: -2
- Move down: top: 20 -> top: 24
- Move up: top: 20 -> top: 16
- Bigger: width: 104, height: 24 -> width: 112, height: 28

Only edit numbers below. Do not edit src paths here.
*/
export const accessoryPositionOverrides: Record<
  Animal,
  Record<Disguise, LayerPosition>
> = {
  Fox: {
    Pirate: { left: 2, top: 22, width: 96, height: 40 },
    Wizard: { left: 6, top: 10, width: 88, height: 44 },
    Detective: { left: 8, top: 25, width: 84, height: 34 },
    Crown: { left: 10, top: 23, width: 80, height: 30 },
    Goggles: { left: 0, top: 34, width: 100, height: 24 },
    Flowers: { left: 3, top: 23, width: 94, height: 36 },
    Shades: { left: -2, top: 40, width: 104, height: 24 },
    Explorer: { left: 4, top: 21, width: 92, height: 34 },
  },
  Dog: {
    Pirate: { left: 2, top: 12, width: 96, height: 40 },
    Wizard: { left: 6, top: -2, width: 88, height: 44 },
    Detective: { left: 8, top: 16, width: 84, height: 33 },
    Crown: { left: 10, top: 16, width: 80, height: 26 },
    Goggles: { left: 0, top: 22, width: 100, height: 24 },
    Flowers: { left: 3, top: 14, width: 94, height: 35 },
    Shades: { left: -2, top: 31, width: 104, height: 24 },
    Explorer: { left: 4, top: 8, width: 92, height: 34 },
  },
  Cat: {
    Pirate: { left: 4, top: 20, width: 94, height: 40 },
    Wizard: { left: 6, top: 5, width: 88, height: 44 },
    Detective: { left: 8, top: 22, width: 84, height: 34 },
    Crown: { left: 10, top: 20, width: 80, height: 26 },
    Goggles: { left: 0, top: 28, width: 100, height: 24 },
    Flowers: { left: 3, top: 22, width: 94, height: 32 },
    Shades: { left: -6, top: 36, width: 112, height: 28 },
    Explorer: { left: 4, top: 18, width: 92, height: 34 },
  },
  Bear: {
    Pirate: { left: 2, top: 13, width: 96, height: 40 },
    Wizard: { left: 6, top: -2, width: 88, height: 44 },
    Detective: { left: 8, top: 13, width: 84, height: 34 },
    Crown: { left: 10, top: 13, width: 80, height: 26 },
    Goggles: { left: 0, top: 41, width: 100, height: 24 },
    Flowers: { left: 3, top: 10, width: 94, height: 40 },
    Shades: { left: -2, top: 32, width: 104, height: 29 },
    Explorer: { left: 4, top: 8, width: 92, height: 34 },
  },
  Rabbit: {
    Pirate: { left: 0, top: 25, width: 100, height: 42 },
    Wizard: { left: 4, top: 5, width: 92, height: 46 },
    Detective: { left: 5, top: 29, width: 90, height: 25 },
    Crown: { left: 8, top: 25, width: 84, height: 30 },
    Goggles: { left: 0, top: 34, width: 100, height: 24 },
    Flowers: { left: 3, top: 28, width: 94, height: 28 },
    Shades: { left: -2, top: 40, width: 104, height: 24 },
    Explorer: { left: 2, top: 29, width: 96, height: 25 },
  },
  Penguin: {
    Pirate: { left: 2, top: 8, width: 96, height: 50 },
    Wizard: { left: 6, top: 0, width: 88, height: 44 },
    Detective: { left: 8, top: 18, width: 84, height: 34 },
    Crown: { left: 10, top: 10, width: 80, height: 40 },
    Goggles: { left: 0, top: 27, width: 100, height: 32 },
    Flowers: { left: 3, top: 15, width: 94, height: 35 },
    Shades: { left: -2, top: 29, width: 104, height: 29 },
    Explorer: { left: 4, top: 13, width: 92, height: 34 },
  },
  Lizard: {
    Pirate: { left: 2, top: 15, width: 96, height: 45 },
    Wizard: { left: 6, top: 4, width: 88, height: 44 },
    Detective: { left: 8, top: 20, width: 84, height: 34 },
    Crown: { left: 10, top: 20, width: 80, height: 26 },
    Goggles: { left: 0, top: 34, width: 100, height: 24 },
    Flowers: { left: 0, top: 16, width: 100, height: 40 },
    Shades: { left: -2, top: 27, width: 104, height: 33 },
    Explorer: { left: 4, top: 15, width: 92, height: 34 },
  },
  Owl: {
    Pirate: { left: 2, top: 0, width: 96, height: 68 },
    Wizard: { left: 6, top: 0, width: 88, height: 44 },
    Detective: { left: 8, top: 17, width: 84, height: 34 },
    Crown: { left: 10, top: 16, width: 80, height: 26 },
    Goggles: { left: 0, top: 34, width: 100, height: 24 },
    Flowers: { left: 7, top: 17, width: 88, height: 33 },
    Shades: { left: -2, top: 28, width: 104, height: 35 },
    Explorer: { left: 4, top: 13, width: 92, height: 34 },
  },
}

const legacyAccessoryMap: Record<string, Disguise> = {
  Astronaut: 'Flowers',
  Aviator: 'Flowers',
  Wig: 'Flowers',
  Robot: 'Shades',
  Ninja: 'Explorer',
  Chef: 'Goggles',
  Knight: 'Shades',
}

export function normalizeAccessory(value: string): Disguise {
  if (value in accessoryAssets) {
    return value as Disguise
  }

  return legacyAccessoryMap[value] ?? 'Pirate'
}

export function getAccessoryAsset(value: string, animal?: Animal): LayerAsset {
  const accessoryName = normalizeAccessory(value)
  const asset = accessoryAssets[accessoryName]
  const overridePosition = animal
    ? accessoryPositionOverrides[animal]?.[accessoryName]
    : undefined

  return {
    ...asset,
    position: overridePosition ?? asset.position,
  }
}
