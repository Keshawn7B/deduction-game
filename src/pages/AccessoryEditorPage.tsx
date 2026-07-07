import type { CSSProperties } from 'react'
import { useMemo, useState } from 'react'
import {
  accessoryAssets,
  accessoryPositionOverrides,
  animalAssets,
  backgroundAssets,
  backgroundFallbacks,
  type LayerPosition,
} from '../game/cardAssets'
import { ANIMALS, DISGUISES } from '../game/deck'
import type { Animal, Disguise, Location } from '../types/card'

const previewLocation: Location = 'Beach'

const sliderFields: Array<{
  key: keyof LayerPosition
  label: string
  min: number
  max: number
  help: string
}> = [
  { key: 'left', label: 'Left / right', min: -25, max: 25, help: 'smaller = left, bigger = right' },
  { key: 'top', label: 'Up / down', min: -10, max: 70, help: 'smaller = up, bigger = down' },
  { key: 'width', label: 'Width', min: 40, max: 140, help: 'bigger = wider' },
  { key: 'height', label: 'Height', min: 15, max: 90, help: 'bigger = taller' },
]

function layerStyle(position: LayerPosition): CSSProperties {
  return {
    left: `${position.left}%`,
    top: `${position.top}%`,
    width: `${position.width}%`,
    height: `${position.height}%`,
  }
}

function formatPosition(position: LayerPosition) {
  return `{ left: ${position.left}, top: ${position.top}, width: ${position.width}, height: ${position.height} }`
}

function makeCopyLine(disguise: Disguise, position: LayerPosition) {
  return `${disguise}: ${formatPosition(position)},`
}

function makeFullCopyBlock(animal: Animal, positions: Record<Disguise, LayerPosition>) {
  const lines = DISGUISES.map((disguise) => `    ${makeCopyLine(disguise, positions[disguise])}`)

  return `  ${animal}: {\n${lines.join('\n')}\n  },`
}

export function AccessoryEditorPage() {
  const [animal, setAnimal] = useState<Animal>('Fox')
  const [disguise, setDisguise] = useState<Disguise>('Shades')
  const [draftPositions, setDraftPositions] = useState(accessoryPositionOverrides)

  const animalAsset = animalAssets[animal]
  const accessoryAsset = accessoryAssets[disguise]
  const background = backgroundAssets[previewLocation]
  const fallback = backgroundFallbacks[previewLocation]
  const position = draftPositions[animal][disguise]

  const animalBlock = useMemo(
    () => makeFullCopyBlock(animal, draftPositions[animal]),
    [animal, draftPositions],
  )

  function updatePosition(key: keyof LayerPosition, value: number) {
    setDraftPositions((current) => ({
      ...current,
      [animal]: {
        ...current[animal],
        [disguise]: {
          ...current[animal][disguise],
          [key]: value,
        },
      },
    }))
  }

  function resetSelected() {
    setDraftPositions((current) => ({
      ...current,
      [animal]: {
        ...current[animal],
        [disguise]: accessoryPositionOverrides[animal][disguise],
      },
    }))
  }

  return (
    <div className="mx-auto min-h-screen max-w-7xl px-4 py-6 text-slate-100 sm:px-6 lg:px-8">
      <div className="rounded-3xl border border-white/10 bg-slate-950/80 p-5 shadow-2xl shadow-cyan-950/40 backdrop-blur">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.3em] text-cyan-200">
              Card accessory editor
            </p>
            <h1 className="mt-2 text-3xl font-black text-white">
              Tune hats, glasses, and accessories visually
            </h1>
            <p className="mt-2 max-w-3xl text-sm font-semibold text-slate-300">
              Pick an animal and accessory, move the sliders, then copy the generated line into
              src/game/cardAssets.ts. This page only changes the preview until you paste the numbers.
            </p>
          </div>
          <a
            href="#/"
            className="rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm font-black text-white hover:bg-white/20"
          >
            Back to game
          </a>
        </div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(280px,420px),1fr]">
        <section className="rounded-3xl border border-white/10 bg-slate-950/82 p-5 shadow-2xl shadow-slate-950/40 backdrop-blur">
          <div className="mx-auto max-w-[320px] overflow-hidden rounded-3xl border border-cyan-300/40 bg-slate-900 shadow-2xl shadow-cyan-950/60">
            <div
              className="relative aspect-[3/4] overflow-hidden bg-cover bg-center"
              style={{ backgroundImage: `url(${background}), ${fallback}` }}
            >
              <div className="absolute inset-0 bg-gradient-to-b from-white/10 via-transparent to-slate-950/40" />
              <img
                src={animalAsset.src}
                alt={animalAsset.alt}
                className="absolute object-contain object-center drop-shadow-2xl"
                draggable={false}
                style={layerStyle(animalAsset.position)}
              />
              <img
                src={accessoryAsset.src}
                alt={accessoryAsset.alt}
                className="absolute object-contain object-center drop-shadow-xl"
                draggable={false}
                style={layerStyle(position)}
              />
              <div className="pointer-events-none absolute inset-2 rounded-2xl border border-white/25" />
            </div>
            <div className="grid grid-cols-2 gap-px bg-slate-800 text-center text-xs">
              <div className="bg-slate-950 px-2 py-3">
                <p className="font-bold text-slate-500">Animal</p>
                <p className="mt-1 font-black text-slate-100">{animal}</p>
              </div>
              <div className="bg-slate-950 px-2 py-3">
                <p className="font-bold text-slate-500">Accessory</p>
                <p className="mt-1 font-black text-slate-100">{disguise}</p>
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-3xl border border-white/10 bg-slate-950/82 p-5 shadow-2xl shadow-slate-950/40 backdrop-blur">
          <div className="grid gap-4 md:grid-cols-2">
            <label className="block">
              <span className="text-xs font-black uppercase tracking-[0.22em] text-cyan-200">
                Animal
              </span>
              <select
                value={animal}
                onChange={(event) => setAnimal(event.target.value as Animal)}
                className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 font-black text-white outline-none focus:border-cyan-300"
              >
                {ANIMALS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="text-xs font-black uppercase tracking-[0.22em] text-cyan-200">
                Accessory
              </span>
              <select
                value={disguise}
                onChange={(event) => setDisguise(event.target.value as Disguise)}
                className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 font-black text-white outline-none focus:border-cyan-300"
              >
                {DISGUISES.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="mt-6 space-y-5">
            {sliderFields.map((field) => (
              <label key={field.key} className="block rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <span className="font-black text-white">{field.label}</span>
                    <p className="text-xs font-semibold text-slate-400">{field.help}</p>
                  </div>
                  <input
                    type="number"
                    value={position[field.key]}
                    min={field.min}
                    max={field.max}
                    onChange={(event) => updatePosition(field.key, Number(event.target.value))}
                    className="w-20 rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-right font-black text-cyan-100 outline-none focus:border-cyan-300"
                  />
                </div>
                <input
                  type="range"
                  value={position[field.key]}
                  min={field.min}
                  max={field.max}
                  onChange={(event) => updatePosition(field.key, Number(event.target.value))}
                  className="mt-3 w-full accent-cyan-300"
                />
              </label>
            ))}
          </div>

          <div className="mt-6 rounded-2xl border border-cyan-300/20 bg-cyan-300/10 p-4">
            <p className="text-xs font-black uppercase tracking-[0.22em] text-cyan-100">
              Copy this line into the {animal} block
            </p>
            <code className="mt-3 block overflow-x-auto rounded-xl bg-slate-950 p-3 text-sm font-bold text-cyan-100">
              {makeCopyLine(disguise, position)}
            </code>
            <button
              type="button"
              onClick={() => void navigator.clipboard?.writeText(makeCopyLine(disguise, position))}
              className="mt-3 rounded-full bg-cyan-300 px-4 py-2 text-sm font-black text-slate-950 hover:bg-cyan-200"
            >
              Copy selected line
            </button>
            <button
              type="button"
              onClick={resetSelected}
              className="ml-3 mt-3 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm font-black text-white hover:bg-white/20"
            >
              Reset selected
            </button>
          </div>
        </section>
      </div>

      <section className="mt-6 rounded-3xl border border-white/10 bg-slate-950/82 p-5 shadow-2xl shadow-slate-950/40 backdrop-blur">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.22em] text-cyan-200">
              Faster bulk edit
            </p>
            <h2 className="mt-1 text-xl font-black text-white">Copy the whole {animal} block</h2>
            <p className="mt-1 text-sm font-semibold text-slate-400">
              Useful after fixing several accessories on the same animal.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void navigator.clipboard?.writeText(animalBlock)}
            className="rounded-full bg-fuchsia-300 px-4 py-2 text-sm font-black text-slate-950 hover:bg-fuchsia-200"
          >
            Copy {animal} block
          </button>
        </div>
        <pre className="mt-4 overflow-x-auto rounded-2xl bg-slate-950 p-4 text-sm font-bold leading-7 text-cyan-100">
          {animalBlock}
        </pre>
      </section>
    </div>
  )
}
