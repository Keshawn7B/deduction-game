import type { Animal, Disguise, Location } from '../types/card'

export type LayerAsset = {
  src: string
  alt: string
  className: string
}

export const backgroundAssets: Record<Location, string> = {
  Beach: '/assets/cards/backgrounds/bkg1.png',
  Moon: '/assets/cards/backgrounds/bkg2.png',
  Castle: '/assets/cards/backgrounds/bkg3.png',
  Forest: '/assets/cards/backgrounds/bkg4.png',
  Museum: '/assets/cards/backgrounds/bkg5.png',
  Kitchen: '/assets/cards/backgrounds/bkg6.png',
  Volcano: '/assets/cards/backgrounds/bkg7.png',
  Library: '/assets/cards/backgrounds/bkg8.png',
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
    src: '/assets/cards/animals/aml1.png',
    alt: 'Fox portrait',
    className: 'left-[12%] top-[24%] h-[60%] w-[76%]',
  },
  Dog: {
    src: '/assets/cards/animals/aml2.png',
    alt: 'Dog portrait',
    className: 'left-[9%] top-[24%] h-[62%] w-[82%]',
  },
  Cat: {
    src: '/assets/cards/animals/aml3.png',
    alt: 'Cat portrait',
    className: 'left-[9.5%] top-[24%] h-[61%] w-[78%]',
  },
  Bear: {
    src: '/assets/cards/animals/aml4.png',
    alt: 'Bear portrait',
    className: 'left-[5%] top-[21%] h-[64%] w-[90%]',
  },
  Rabbit: {
    src: '/assets/cards/animals/aml5.png',
    alt: 'Rabbit portrait',
    className: 'left-[10%] top-[16%] h-[68%] w-[80%]',
  },
  Penguin: {
    src: '/assets/cards/animals/aml6.png',
    alt: 'Penguin portrait',
    className: 'left-[8%] top-[25%] h-[62%] w-[84%]',
  },
  Lizard: {
    src: '/assets/cards/animals/aml7.png',
    alt: 'Lizard portrait',
    className: 'left-[7%] top-[28%] h-[58%] w-[86%]',
  },
  Owl: {
    src: '/assets/cards/animals/aml8.png',
    alt: 'Owl portrait',
    className: 'left-[8%] top-[20%] h-[65%] w-[84%]',
  },
}

export const accessoryAssets: Record<Disguise, LayerAsset> = {
  Pirate: {
    src: '/assets/cards/accessories/acc1.png',
    alt: 'Pirate accessory',
    className: 'left-[2%] top-[18%] h-[40%] w-[96%]',
  },
  Wizard: {
    src: '/assets/cards/accessories/acc2.png',
    alt: 'Wizard accessory',
    className: 'left-[6%] top-[-2%] h-[44%] w-[88%]',
  },
  Detective: {
    src: '/assets/cards/accessories/acc3.png',
    alt: 'Detective accessory',
    className: 'left-[8%] top-[8%] h-[34%] w-[84%]',
  },
  Crown: {
    src: '/assets/cards/accessories/acc4.png',
    alt: 'Crown accessory',
    className: 'left-[10%] top-[8%] h-[26%] w-[80%]',
  },
  Goggles: {
    src: '/assets/cards/accessories/acc5.png',
    alt: 'Goggles accessory',
    className: 'left-[0%] top-[34%] h-[24%] w-full',
  },
  Flowers: {
    src: '/assets/cards/accessories/acc6.png',
    alt: 'Flowers accessory',
    className: 'left-[2%] top-[12%] h-[42%] w-[96%]',
  },
  Shades: {
    src: '/assets/cards/accessories/acc7.png',
    alt: 'Shades accessory',
    className: 'left-[1%] top-[40%] h-[24%] w-[104%]',
  },
  Explorer: {
    src: '/assets/cards/accessories/acc8.png',
    alt: 'Explorer accessory',
    className: 'left-[4%] top-[8%] h-[34%] w-[92%]',
  },
}

export const accessoryPositionOverrides: Partial<
  Record<Animal, Partial<Record<Disguise, string>>>
> = {
  Cat: {
    Shades: 'left-[-1%] top-[38%] h-[28%] w-[112%]',
  },
  Rabbit: {
    Pirate: 'left-[0%] top-[0%] h-[42%] w-[100%]',
    Wizard: 'left-[4%] top-[-4%] h-[46%] w-[92%]',
    Detective: 'left-[5%] top-[5%] h-[36%] w-[90%]',
    Crown: 'left-[8%] top-[5%] h-[30%] w-[84%]',
    Explorer: 'left-[2%] top-[5%] h-[36%] w-[96%]',
  },
}

const legacyAccessoryMap: Record<string, Disguise> = {
  Astronaut: 'Flowers',
  Aviator: 'Flowers',
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

export function getAccessoryAsset(
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
