import { useState } from 'react'
import type { Player } from '../types'
import { contrastText } from '../colors'
import {
  scoreCity,
  scoreCloister,
  scoreField,
  scoreRoad,
  type FeatureType,
  type PresetResult,
} from '../scoring'

interface Props {
  player: Player
  onClose: () => void
  onScore: (amount: number, label: string) => void
}

type Tab = 'preset' | 'manual'

/** Modal for adding points to a player via Carcassonne presets or manual entry. */
export function ScoreModal({ player, onClose, onScore }: Props) {
  const [tab, setTab] = useState<Tab>('preset')

  const apply = (result: PresetResult) => {
    onScore(result.amount, result.label)
    onClose()
  }

  return (
    <div
      className="fixed inset-0 z-30 flex items-end justify-center bg-black/60 sm:items-center"
      onClick={onClose}
    >
      <div
        className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-gray-800 p-5 shadow-2xl sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center gap-3">
          <span
            className="flex h-10 w-10 items-center justify-center rounded-full text-base font-bold"
            style={{ backgroundColor: player.color, color: contrastText(player.color) }}
          >
            {player.name.charAt(0).toUpperCase() || '?'}
          </span>
          <div className="min-w-0 flex-1">
            <div className="truncate text-lg font-bold">{player.name}</div>
            <div className="text-sm text-white/50">Current: {player.score} pts</div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg px-2 py-1 text-white/50 hover:bg-white/10"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <div className="mb-4 grid grid-cols-2 gap-1 rounded-xl bg-black/30 p-1 text-sm font-medium">
          <button
            onClick={() => setTab('preset')}
            className={`rounded-lg py-2 transition ${
              tab === 'preset' ? 'bg-white/15' : 'text-white/50'
            }`}
          >
            Features
          </button>
          <button
            onClick={() => setTab('manual')}
            className={`rounded-lg py-2 transition ${
              tab === 'manual' ? 'bg-white/15' : 'text-white/50'
            }`}
          >
            Manual
          </button>
        </div>

        {tab === 'preset' ? (
          <PresetForms onApply={apply} />
        ) : (
          <ManualForm onApply={apply} />
        )}
      </div>
    </div>
  )
}

function PresetForms({ onApply }: { onApply: (r: PresetResult) => void }) {
  const [feature, setFeature] = useState<FeatureType>('road')

  const features: { key: FeatureType; label: string }[] = [
    { key: 'road', label: 'Road' },
    { key: 'city', label: 'City' },
    { key: 'cloister', label: 'Cloister' },
    { key: 'field', label: 'Field' },
  ]

  return (
    <div>
      <div className="mb-4 grid grid-cols-4 gap-1.5">
        {features.map((f) => (
          <button
            key={f.key}
            onClick={() => setFeature(f.key)}
            className={`rounded-lg py-2 text-sm font-medium transition ${
              feature === f.key
                ? 'bg-amber-500 text-gray-900'
                : 'bg-white/5 text-white/70 hover:bg-white/10'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {feature === 'road' && <RoadForm onApply={onApply} />}
      {feature === 'city' && <CityForm onApply={onApply} />}
      {feature === 'cloister' && <CloisterForm onApply={onApply} />}
      {feature === 'field' && <FieldForm onApply={onApply} />}
    </div>
  )
}

function NumberField({
  label,
  value,
  onChange,
  min = 0,
}: {
  label: string
  value: number
  onChange: (n: number) => void
  min?: number
}) {
  return (
    <div className="flex items-center justify-between gap-3 py-1.5">
      <span className="text-sm text-white/80">{label}</span>
      <div className="flex items-center gap-2">
        <button
          onClick={() => onChange(Math.max(min, value - 1))}
          className="h-9 w-9 rounded-lg bg-white/10 text-lg font-bold hover:bg-white/20 active:scale-95"
          aria-label={`Decrease ${label}`}
        >
          −
        </button>
        <input
          type="number"
          inputMode="numeric"
          value={value}
          onChange={(e) => onChange(Math.max(min, Math.floor(Number(e.target.value) || 0)))}
          className="w-14 rounded-lg bg-black/30 py-2 text-center text-base outline-none ring-1 ring-white/10 focus:ring-white/30"
        />
        <button
          onClick={() => onChange(value + 1)}
          className="h-9 w-9 rounded-lg bg-white/10 text-lg font-bold hover:bg-white/20 active:scale-95"
          aria-label={`Increase ${label}`}
        >
          +
        </button>
      </div>
    </div>
  )
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string
  checked: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <label className="flex cursor-pointer items-center justify-between py-1.5">
      <span className="text-sm text-white/80">{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative h-6 w-11 rounded-full transition ${
          checked ? 'bg-emerald-500' : 'bg-white/20'
        }`}
      >
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition ${
            checked ? 'left-[1.375rem]' : 'left-0.5'
          }`}
        />
      </button>
    </label>
  )
}

function ApplyBar({ result, onApply }: { result: PresetResult; onApply: (r: PresetResult) => void }) {
  return (
    <button
      onClick={() => onApply(result)}
      className="mt-4 w-full rounded-xl bg-emerald-500 py-3 text-lg font-bold text-white transition hover:bg-emerald-400 active:scale-[0.98]"
    >
      Add {result.amount} {result.amount === 1 ? 'point' : 'points'}
    </button>
  )
}

function RoadForm({ onApply }: { onApply: (r: PresetResult) => void }) {
  const [tiles, setTiles] = useState(2)
  return (
    <div>
      <NumberField label="Tiles" value={tiles} onChange={setTiles} min={1} />
      <p className="mt-1 text-xs text-white/40">1 point per tile.</p>
      <ApplyBar result={scoreRoad(tiles)} onApply={onApply} />
    </div>
  )
}

function CityForm({ onApply }: { onApply: (r: PresetResult) => void }) {
  const [tiles, setTiles] = useState(2)
  const [pennants, setPennants] = useState(0)
  const [completed, setCompleted] = useState(true)
  return (
    <div>
      <NumberField label="Tiles" value={tiles} onChange={setTiles} min={1} />
      <NumberField label="Pennants" value={pennants} onChange={setPennants} />
      <Toggle label="Completed" checked={completed} onChange={setCompleted} />
      <p className="mt-1 text-xs text-white/40">
        Completed: 2 per tile + 2 per pennant. Incomplete (game end): 1 each.
      </p>
      <ApplyBar result={scoreCity(tiles, pennants, completed)} onApply={onApply} />
    </div>
  )
}

function CloisterForm({ onApply }: { onApply: (r: PresetResult) => void }) {
  const [surrounding, setSurrounding] = useState(8)
  const completed = surrounding >= 8
  return (
    <div>
      <NumberField
        label="Surrounding tiles"
        value={surrounding}
        onChange={(n) => setSurrounding(Math.min(8, n))}
      />
      <p className="mt-1 text-xs text-white/40">
        1 for the cloister + 1 per surrounding tile (max 9).
      </p>
      <ApplyBar result={scoreCloister(surrounding, completed)} onApply={onApply} />
    </div>
  )
}

function FieldForm({ onApply }: { onApply: (r: PresetResult) => void }) {
  const [cities, setCities] = useState(1)
  return (
    <div>
      <NumberField label="Completed cities" value={cities} onChange={setCities} />
      <p className="mt-1 text-xs text-white/40">
        Scored at game end: 3 points per completed city the field borders.
      </p>
      <ApplyBar result={scoreField(cities)} onApply={onApply} />
    </div>
  )
}

function ManualForm({ onApply }: { onApply: (r: PresetResult) => void }) {
  const [amount, setAmount] = useState(1)

  const submit = (sign: 1 | -1) => {
    const value = sign * Math.abs(amount)
    if (value === 0) return
    onApply({ amount: value, label: `Manual ${value > 0 ? '+' : ''}${value}` })
  }

  const quick = [1, 2, 3, 5, 10]

  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-2">
        {quick.map((q) => (
          <button
            key={q}
            onClick={() => setAmount(q)}
            className={`rounded-lg px-3 py-2 text-sm font-semibold transition ${
              amount === q ? 'bg-amber-500 text-gray-900' : 'bg-white/10 hover:bg-white/20'
            }`}
          >
            {q}
          </button>
        ))}
      </div>
      <NumberField label="Points" value={amount} onChange={setAmount} min={1} />
      <div className="mt-4 grid grid-cols-2 gap-2">
        <button
          onClick={() => submit(-1)}
          className="rounded-xl bg-red-500/80 py-3 text-lg font-bold text-white transition hover:bg-red-500 active:scale-[0.98]"
        >
          − {Math.abs(amount)}
        </button>
        <button
          onClick={() => submit(1)}
          className="rounded-xl bg-emerald-500 py-3 text-lg font-bold text-white transition hover:bg-emerald-400 active:scale-[0.98]"
        >
          + {Math.abs(amount)}
        </button>
      </div>
    </div>
  )
}
