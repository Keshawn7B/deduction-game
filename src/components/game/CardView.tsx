import { normalizeAccessory } from '../../game/cardAssets'
import type { Card } from '../../types/card'
import { LayeredCardArt } from './LayeredCardArt'

type CardViewProps = {
  card: Card
  label?: string
}

export function CardView({ card, label }: CardViewProps) {
  const accessoryName = normalizeAccessory(card.disguise)

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-700 bg-slate-950 shadow transition hover:border-cyan-400/60">
      <div className="relative aspect-[3/4] bg-slate-900">
        {label ? (
          <div className="absolute right-3 top-3 z-10 rounded-full bg-cyan-300 px-3 py-1 text-xs font-black uppercase tracking-[0.18em] text-slate-950 shadow">
            {label}
          </div>
        ) : null}

        <LayeredCardArt card={card} />
      </div>

      <div className="grid grid-cols-3 gap-px bg-slate-800 text-center text-xs">
        <div className="bg-slate-950 px-2 py-2">
          <p className="font-bold text-slate-500">Animal</p>
          <p className="mt-1 font-black text-slate-100">{card.animal}</p>
        </div>

        <div className="bg-slate-950 px-2 py-2">
          <p className="font-bold text-slate-500">Accessory</p>
          <p className="mt-1 font-black text-slate-100">{accessoryName}</p>
        </div>

        <div className="bg-slate-950 px-2 py-2">
          <p className="font-bold text-slate-500">Location</p>
          <p className="mt-1 font-black text-slate-100">{card.location}</p>
        </div>
      </div>
    </div>
  )
}
