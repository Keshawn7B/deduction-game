import {
  accessoryAssets,
  animalAssets,
  backgroundAssets,
} from './cardAssets'
import { getCardSetOptions } from './deck'
import type { CardSetSize } from '../types/card'

type LegendItemData = {
  name: string
  image: string
  alt: string
}

export type LegendGroupData = {
  name: 'animals' | 'backgrounds' | 'accessories'
  title: string
  items: LegendItemData[]
}

export function getLegendGroups(cardSetSize: CardSetSize): LegendGroupData[] {
  const options = getCardSetOptions(cardSetSize)

  return [
    {
      name: 'animals',
      title: `${cardSetSize} animals`,
      items: options.animals.map((name) => ({
        name,
        image: animalAssets[name].src,
        alt: animalAssets[name].alt,
      })),
    },
    {
      name: 'backgrounds',
      title: `${cardSetSize} backgrounds`,
      items: options.locations.map((name) => ({
        name,
        image: backgroundAssets[name],
        alt: `${name} background`,
      })),
    },
    {
      name: 'accessories',
      title: `${cardSetSize} accessories`,
      items: options.disguises.map((name) => ({
        name,
        image: accessoryAssets[name].src,
        alt: accessoryAssets[name].alt,
      })),
    },
  ]
}
