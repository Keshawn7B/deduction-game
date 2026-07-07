import type { CSSProperties, SyntheticEvent } from 'react'
import type { Card } from '../../types/card'
import {
  animalAssets,
  backgroundAssets,
  backgroundFallbacks,
  getAccessoryAsset,
  normalizeAccessory,
  type LayerPosition,
} from '../../game/cardAssets'

type LayeredCardArtProps = {
  card: Card
}

function hideBrokenImage(event: SyntheticEvent<HTMLImageElement>) {
  event.currentTarget.style.display = 'none'
}

function layerStyle(position: LayerPosition): CSSProperties {
  return {
    left: `${position.left}%`,
    top: `${position.top}%`,
    width: `${position.width}%`,
    height: `${position.height}%`,
  }
}

export function LayeredCardArt({ card }: LayeredCardArtProps) {
  const animal = animalAssets[card.animal] ?? animalAssets.Fox
  const accessory = getAccessoryAsset(card.disguise, card.animal)
  const accessoryName = normalizeAccessory(card.disguise)
  const background = backgroundAssets[card.location] ?? backgroundAssets.Beach
  const fallback = backgroundFallbacks[card.location] ?? backgroundFallbacks.Beach

  return (
    <div
      className="relative h-full w-full overflow-hidden bg-cover bg-center"
      style={{
        backgroundImage: `url(${background}), ${fallback}`,
      }}
      aria-label={`${card.animal} wearing ${accessoryName} at ${card.location}`}
      role="img"
    >
      <div className="absolute inset-0 bg-gradient-to-b from-white/10 via-transparent to-slate-950/40" />

      <div className="absolute left-[7%] top-[8%] rounded-full bg-slate-950/55 px-3 py-1 text-xs font-black uppercase tracking-[0.22em] text-white shadow">
        {card.location}
      </div>

      <img
        src={animal.src}
        alt={animal.alt}
        className="absolute object-contain object-center drop-shadow-2xl"
        style={layerStyle(animal.position)}
        draggable={false}
        onError={hideBrokenImage}
      />

      <img
        src={accessory.src}
        alt={accessory.alt}
        className="absolute object-contain object-center drop-shadow-xl"
        style={layerStyle(accessory.position)}
        draggable={false}
        onError={hideBrokenImage}
      />

      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-slate-950 via-slate-950/88 to-transparent px-4 pb-4 pt-14">
        <p className="text-xl font-black leading-none text-white drop-shadow">
          {card.animal}
        </p>
        <p className="mt-1 text-sm font-bold text-cyan-200 drop-shadow">
          {accessoryName}
        </p>
      </div>

      <div className="pointer-events-none absolute inset-2 rounded-2xl border border-white/25" />
    </div>
  )
}
