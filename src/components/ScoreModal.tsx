import { useState } from 'react'
import type { Player, ScoreDescriptor, TradeGoods } from '../types'
import { contrastText } from '../colors'
import { useI18n } from '../i18n'
import {
  CATHEDRAL_EMOJI,
  FEATURE_EMOJI,
  GOODS_EMOJI,
  INN_EMOJI,
  PIG_EMOJI,
  scoreCastle,
  scoreCity,
  scoreCloister,
  scoreField,
  scoreRoad,
  type FeatureType,
} from '../scoring'

interface Props {
  player: Player
  onClose: () => void
  onScore: (amount: number, desc: ScoreDescriptor) => void
  onAddGoods: (delta: Partial<TradeGoods>) => void
}

type Tab = 'preset' | 'goods' | 'manual'

/** Modal for adding points to a player via Carcassonne presets or manual entry. */
export function ScoreModal({ player, onClose, onScore, onAddGoods }: Props) {
  const { t } = useI18n()
  const [tab, setTab] = useState<Tab>('preset')

  const apply = (amount: number, desc: ScoreDescriptor) => {
    onScore(amount, desc)
    onClose()
  }

  const tabs: { key: Tab; label: string }[] = [
    { key: 'preset', label: t.featuresTab },
    { key: 'goods', label: `${GOODS_EMOJI.wine} ${t.goodsTab}` },
    { key: 'manual', label: `${FEATURE_EMOJI.manual} ${t.manualTab}` },
  ]

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
            <div className="text-sm text-white/50">{t.currentScore(player.score)}</div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg px-2 py-1 text-white/50 hover:bg-white/10"
            aria-label={t.close}
          >
            ✕
          </button>
        </div>

        <div className="mb-4 grid grid-cols-3 gap-1 rounded-xl bg-black/30 p-1 text-sm font-medium">
          {tabs.map((tb) => (
            <button
              key={tb.key}
              onClick={() => setTab(tb.key)}
              className={`rounded-lg py-2 transition ${
                tab === tb.key ? 'bg-white/15' : 'text-white/50'
              }`}
            >
              {tb.label}
            </button>
          ))}
        </div>

        {tab === 'preset' && <PresetForms onApply={apply} />}
        {tab === 'goods' && (
          <GoodsForm
            onRecord={(delta) => {
              onAddGoods(delta)
              onClose()
            }}
          />
        )}
        {tab === 'manual' && <ManualForm onApply={apply} />}
      </div>
    </div>
  )
}

type ApplyFn = (amount: number, desc: ScoreDescriptor) => void

function PresetForms({ onApply }: { onApply: ApplyFn }) {
  const { t } = useI18n()
  const [feature, setFeature] = useState<FeatureType>('road')

  const features: FeatureType[] = ['road', 'city', 'cloister', 'field', 'castle']

  return (
    <div>
      <div className="mb-4 grid grid-cols-3 gap-1.5">
        {features.map((key) => (
          <button
            key={key}
            onClick={() => setFeature(key)}
            className={`flex flex-col items-center gap-0.5 rounded-lg py-2 text-xs font-medium transition ${
              feature === key
                ? 'bg-amber-500 text-gray-900'
                : 'bg-white/5 text-white/70 hover:bg-white/10'
            }`}
          >
            <span className="text-xl leading-none">{FEATURE_EMOJI[key]}</span>
            {t.featureNames[key]}
          </button>
        ))}
      </div>

      {feature === 'road' && <RoadForm onApply={onApply} />}
      {feature === 'city' && <CityForm onApply={onApply} />}
      {feature === 'cloister' && <CloisterForm onApply={onApply} />}
      {feature === 'field' && <FieldForm onApply={onApply} />}
      {feature === 'castle' && <CastleForm onApply={onApply} />}
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
  const { t } = useI18n()
  return (
    <div className="flex items-center justify-between gap-3 py-1.5">
      <span className="text-sm text-white/80">{label}</span>
      <div className="flex items-center gap-2">
        <button
          onClick={() => onChange(Math.max(min, value - 1))}
          className="h-9 w-9 rounded-lg bg-white/10 text-lg font-bold hover:bg-white/20 active:scale-95"
          aria-label={t.decreaseAria(label)}
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
          aria-label={t.increaseAria(label)}
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
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex w-full cursor-pointer items-center justify-between py-1.5 text-left"
    >
      <span className="text-sm text-white/80">{label}</span>
      <span
        className={`relative h-6 w-11 shrink-0 rounded-full transition ${
          checked ? 'bg-emerald-500' : 'bg-white/20'
        }`}
      >
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition ${
            checked ? 'left-[1.375rem]' : 'left-0.5'
          }`}
        />
      </span>
    </button>
  )
}

function ApplyBar({
  amount,
  desc,
  onApply,
}: {
  amount: number
  desc: ScoreDescriptor
  onApply: ApplyFn
}) {
  const { t } = useI18n()
  return (
    <button
      onClick={() => onApply(amount, desc)}
      className="mt-4 w-full rounded-xl bg-emerald-500 py-3 text-lg font-bold text-white transition hover:bg-emerald-400 active:scale-[0.98]"
    >
      {t.addPoints(amount)}
    </button>
  )
}

function RoadForm({ onApply }: { onApply: ApplyFn }) {
  const { t } = useI18n()
  const [tiles, setTiles] = useState(2)
  const [inn, setInn] = useState(false)
  const [completed, setCompleted] = useState(true)
  return (
    <div>
      <NumberField label={t.tiles} value={tiles} onChange={setTiles} min={1} />
      <Toggle label={`${INN_EMOJI} ${t.inn}`} checked={inn} onChange={setInn} />
      {inn && (
        <Toggle label={t.completed} checked={completed} onChange={setCompleted} />
      )}
      <p className="mt-1 text-xs text-white/40">{t.roadHint}</p>
      <ApplyBar
        amount={scoreRoad(tiles, completed, inn)}
        desc={{ kind: 'road', tiles, completed, inn }}
        onApply={onApply}
      />
    </div>
  )
}

function CityForm({ onApply }: { onApply: ApplyFn }) {
  const { t } = useI18n()
  const [tiles, setTiles] = useState(2)
  const [pennants, setPennants] = useState(0)
  const [completed, setCompleted] = useState(true)
  const [cathedral, setCathedral] = useState(false)
  return (
    <div>
      <NumberField label={t.tiles} value={tiles} onChange={setTiles} min={1} />
      <NumberField label={t.pennants} value={pennants} onChange={setPennants} />
      <Toggle label={t.completed} checked={completed} onChange={setCompleted} />
      <Toggle
        label={`${CATHEDRAL_EMOJI} ${t.cathedral}`}
        checked={cathedral}
        onChange={setCathedral}
      />
      <p className="mt-1 text-xs text-white/40">{t.cityHint}</p>
      <ApplyBar
        amount={scoreCity(tiles, pennants, completed, cathedral)}
        desc={{ kind: 'city', tiles, pennants, completed, cathedral }}
        onApply={onApply}
      />
    </div>
  )
}

function CloisterForm({ onApply }: { onApply: ApplyFn }) {
  const { t } = useI18n()
  const [surrounding, setSurrounding] = useState(8)
  const completed = surrounding >= 8
  return (
    <div>
      <NumberField
        label={t.surroundingTiles}
        value={surrounding}
        onChange={(n) => setSurrounding(Math.min(8, n))}
      />
      <p className="mt-1 text-xs text-white/40">{t.cloisterHint}</p>
      <ApplyBar
        amount={scoreCloister(surrounding, completed)}
        desc={{ kind: 'cloister', surrounding, completed }}
        onApply={onApply}
      />
    </div>
  )
}

function FieldForm({ onApply }: { onApply: ApplyFn }) {
  const { t } = useI18n()
  const [cities, setCities] = useState(1)
  const [pig, setPig] = useState(false)
  return (
    <div>
      <NumberField label={t.completedCities} value={cities} onChange={setCities} />
      <Toggle label={`${PIG_EMOJI} ${t.pig}`} checked={pig} onChange={setPig} />
      <p className="mt-1 text-xs text-white/40">{t.fieldHint}</p>
      <ApplyBar
        amount={scoreField(cities, pig)}
        desc={{ kind: 'field', cities, pig }}
        onApply={onApply}
      />
    </div>
  )
}

function CastleForm({ onApply }: { onApply: ApplyFn }) {
  const { t } = useI18n()
  const [value, setValue] = useState(4)
  return (
    <div>
      <NumberField label={t.castleValue} value={value} onChange={setValue} min={0} />
      <p className="mt-1 text-xs text-white/40">{t.castleHint}</p>
      <ApplyBar amount={scoreCastle(value)} desc={{ kind: 'castle', value }} onApply={onApply} />
    </div>
  )
}

function GoodsForm({ onRecord }: { onRecord: (delta: Partial<TradeGoods>) => void }) {
  const { t } = useI18n()
  const [wine, setWine] = useState(0)
  const [grain, setGrain] = useState(0)
  const [cloth, setCloth] = useState(0)
  const total = wine + grain + cloth

  return (
    <div>
      <NumberField label={`${GOODS_EMOJI.wine} ${t.goodNames.wine}`} value={wine} onChange={setWine} />
      <NumberField label={`${GOODS_EMOJI.grain} ${t.goodNames.grain}`} value={grain} onChange={setGrain} />
      <NumberField label={`${GOODS_EMOJI.cloth} ${t.goodNames.cloth}`} value={cloth} onChange={setCloth} />
      <p className="mt-1 text-xs text-white/40">{t.goodsTabHint}</p>
      <button
        disabled={total === 0}
        onClick={() => onRecord({ wine, grain, cloth })}
        className="mt-4 w-full rounded-xl bg-emerald-500 py-3 text-lg font-bold text-white transition enabled:hover:bg-emerald-400 enabled:active:scale-[0.98] disabled:opacity-40"
      >
        {t.recordGoods}
      </button>
    </div>
  )
}

function ManualForm({ onApply }: { onApply: ApplyFn }) {
  const { t } = useI18n()
  const [amount, setAmount] = useState(1)

  const submit = (sign: 1 | -1) => {
    const value = sign * Math.abs(amount)
    if (value === 0) return
    onApply(value, { kind: 'manual', amount: value })
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
      <NumberField label={t.points} value={amount} onChange={setAmount} min={1} />
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
