import { useState } from 'react'
import type {
  CircusAnimal,
  MagicFigure,
  Player,
  ScoreDescriptor,
  TokenDelta,
} from '../types'
import type { ExpansionConfig } from '../expansions'
import { contrastText } from '../colors'
import { formatDescriptor, useI18n } from '../i18n'
import {
  ANIMAL_EMOJI,
  ANIMAL_VALUE,
  CATHEDRAL_EMOJI,
  FEATURE_EMOJI,
  GOODS_EMOJI,
  INN_EMOJI,
  MAGE_EMOJI,
  PIG_EMOJI,
  WITCH_EMOJI,
  applyMagic,
  scoreAcrobats,
  scoreCastle,
  scoreCircus,
  scoreCity,
  scoreCloister,
  scoreField,
  scoreMessage,
  scoreRingmaster,
  scoreRoad,
  type FeatureType,
} from '../scoring'

/** A recent feature score offered as a one-tap castle value. */
export interface CastleEntry {
  id: string
  amount: number
  desc: ScoreDescriptor
  playerName: string
  playerColor: string
}

interface Props {
  player: Player
  /** Recent feature scores the castle can borrow its value from. */
  recentFeatures: CastleEntry[]
  /** Active expansions — gates which scoring inputs appear. */
  expansions: ExpansionConfig
  /** Pre-select this feature in the Features grid (e.g. 'message' from a badge). */
  initialFeature?: FeatureType
  onClose: () => void
  onScore: (amount: number, desc: ScoreDescriptor) => void
  onRecordTokens: (delta: TokenDelta) => void
}

type Tab = 'preset' | 'goods' | 'manual'

/** Modal for adding points to a player via Carcassonne presets or manual entry. */
export function ScoreModal({
  player,
  recentFeatures,
  expansions,
  initialFeature,
  onClose,
  onScore,
  onRecordTokens,
}: Props) {
  const { t } = useI18n()
  const [tab, setTab] = useState<Tab>('preset')

  const apply = (amount: number, desc: ScoreDescriptor) => {
    onScore(amount, desc)
    onClose()
  }

  const showGoodsTab = expansions.tradersBuilders || expansions.goldMines
  const tabs: { key: Tab; label: string }[] = [
    { key: 'preset', label: t.featuresTab },
    ...(showGoodsTab
      ? [{ key: 'goods' as const, label: `${GOODS_EMOJI.wine} ${t.goodsTab}` }]
      : []),
    { key: 'manual', label: `${FEATURE_EMOJI.manual} ${t.manualTab}` },
  ]

  return (
    <div
      className="fixed inset-0 z-30 flex items-end justify-center bg-black/60 sm:items-center"
      onClick={onClose}
    >
      <div
        className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-gray-800 px-5 pt-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-2xl sm:rounded-3xl"
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

        <div
          className="mb-4 grid gap-1 rounded-xl bg-black/30 p-1 text-sm font-medium"
          style={{ gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))` }}
        >
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

        {tab === 'preset' && (
          <PresetForms
            onApply={apply}
            recentFeatures={recentFeatures}
            expansions={expansions}
            initialFeature={initialFeature}
          />
        )}
        {tab === 'goods' && showGoodsTab && (
          <GoodsForm
            tradersBuilders={expansions.tradersBuilders}
            goldMines={expansions.goldMines}
            onRecord={(delta) => {
              onRecordTokens(delta)
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

function PresetForms({
  onApply,
  recentFeatures,
  expansions,
  initialFeature,
}: {
  onApply: ApplyFn
  recentFeatures: CastleEntry[]
  expansions: ExpansionConfig
  initialFeature?: FeatureType
}) {
  const { t } = useI18n()
  const [feature, setFeature] = useState<FeatureType>(initialFeature ?? 'road')

  const features: FeatureType[] = [
    'road',
    'city',
    'cloister',
    'field',
    ...(expansions.bridgesCastlesBazaars ? (['castle'] as const) : []),
    ...(expansions.messages ? (['message'] as const) : []),
    ...(expansions.circus
      ? (['circus', 'acrobats', 'ringmaster'] as const)
      : []),
  ]

  // The selected feature may have been hidden by an expansion toggle; fall back.
  const active = features.includes(feature) ? feature : 'road'

  return (
    <div>
      <div className="mb-4 grid grid-cols-3 gap-1.5">
        {features.map((key) => (
          <button
            key={key}
            onClick={() => setFeature(key)}
            className={`flex flex-col items-center gap-0.5 rounded-lg py-2 text-xs font-medium transition ${
              active === key
                ? 'bg-amber-500 text-gray-900'
                : 'bg-white/5 text-white/70 hover:bg-white/10'
            }`}
          >
            <span className="text-xl leading-none">{FEATURE_EMOJI[key]}</span>
            {t.featureNames[key]}
          </button>
        ))}
      </div>

      {active === 'road' && (
        <RoadForm
          onApply={onApply}
          innsCathedrals={expansions.innsCathedrals}
          mageWitch={expansions.mageWitch}
        />
      )}
      {active === 'city' && (
        <CityForm
          onApply={onApply}
          innsCathedrals={expansions.innsCathedrals}
          mageWitch={expansions.mageWitch}
        />
      )}
      {active === 'cloister' && <CloisterForm onApply={onApply} />}
      {active === 'field' && (
        <FieldForm
          onApply={onApply}
          tradersBuilders={expansions.tradersBuilders}
          bridgesCastlesBazaars={expansions.bridgesCastlesBazaars}
        />
      )}
      {active === 'castle' && (
        <CastleForm onApply={onApply} recentFeatures={recentFeatures} />
      )}
      {active === 'message' && <MessageForm onApply={onApply} />}
      {active === 'circus' && <CircusForm onApply={onApply} />}
      {active === 'acrobats' && <AcrobatsForm onApply={onApply} />}
      {active === 'ringmaster' && <RingmasterForm onApply={onApply} />}
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

/** 3-way None / Mage / Witch selector for road & city (Mage & Witch). */
function MagicControl({
  value,
  onChange,
}: {
  value: MagicFigure
  onChange: (m: MagicFigure) => void
}) {
  const { t } = useI18n()
  const opts: { key: MagicFigure; label: string }[] = [
    { key: 'none', label: t.magicNone },
    { key: 'mage', label: `${MAGE_EMOJI} ${t.mage}` },
    { key: 'witch', label: `${WITCH_EMOJI} ${t.witch}` },
  ]
  return (
    <div className="py-1.5">
      <span className="mb-1 block text-sm text-white/80">{t.magicLabel}</span>
      <div className="grid grid-cols-3 gap-1 rounded-lg bg-black/30 p-0.5 text-xs font-medium">
        {opts.map((o) => (
          <button
            key={o.key}
            onClick={() => onChange(o.key)}
            className={`rounded-md px-2 py-1.5 transition ${
              value === o.key ? 'bg-white/15' : 'text-white/50'
            }`}
            aria-pressed={value === o.key}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  )
}

function RoadForm({
  onApply,
  innsCathedrals,
  mageWitch,
}: {
  onApply: ApplyFn
  innsCathedrals: boolean
  mageWitch: boolean
}) {
  const { t } = useI18n()
  const [tiles, setTiles] = useState(2)
  const [inn, setInn] = useState(false)
  const [completed, setCompleted] = useState(true)
  const [magic, setMagic] = useState<MagicFigure>('none')
  const amount = applyMagic(scoreRoad(tiles, completed, inn), tiles, magic)
  return (
    <div>
      <NumberField label={t.tiles} value={tiles} onChange={setTiles} min={1} />
      {innsCathedrals && (
        <Toggle label={`${INN_EMOJI} ${t.inn}`} checked={inn} onChange={setInn} />
      )}
      {innsCathedrals && inn && (
        <Toggle label={t.completed} checked={completed} onChange={setCompleted} />
      )}
      {mageWitch && <MagicControl value={magic} onChange={setMagic} />}
      <p className="mt-1 text-xs text-white/40">{t.roadHint}</p>
      <ApplyBar
        amount={amount}
        desc={{ kind: 'road', tiles, completed, inn, magic }}
        onApply={onApply}
      />
    </div>
  )
}

function CityForm({
  onApply,
  innsCathedrals,
  mageWitch,
}: {
  onApply: ApplyFn
  innsCathedrals: boolean
  mageWitch: boolean
}) {
  const { t } = useI18n()
  const [tiles, setTiles] = useState(2)
  const [pennants, setPennants] = useState(0)
  const [completed, setCompleted] = useState(true)
  const [cathedral, setCathedral] = useState(false)
  const [magic, setMagic] = useState<MagicFigure>('none')
  const amount = applyMagic(
    scoreCity(tiles, pennants, completed, cathedral),
    tiles,
    magic,
  )
  return (
    <div>
      <NumberField label={t.tiles} value={tiles} onChange={setTiles} min={1} />
      <NumberField label={t.pennants} value={pennants} onChange={setPennants} />
      <Toggle label={t.completed} checked={completed} onChange={setCompleted} />
      {innsCathedrals && (
        <Toggle
          label={`${CATHEDRAL_EMOJI} ${t.cathedral}`}
          checked={cathedral}
          onChange={setCathedral}
        />
      )}
      {mageWitch && <MagicControl value={magic} onChange={setMagic} />}
      <p className="mt-1 text-xs text-white/40">{t.cityHint}</p>
      <ApplyBar
        amount={amount}
        desc={{ kind: 'city', tiles, pennants, completed, cathedral, magic }}
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

function FieldForm({
  onApply,
  tradersBuilders,
  bridgesCastlesBazaars,
}: {
  onApply: ApplyFn
  tradersBuilders: boolean
  bridgesCastlesBazaars: boolean
}) {
  const { t } = useI18n()
  const [cities, setCities] = useState(1)
  const [pig, setPig] = useState(false)
  const [castles, setCastles] = useState(0)
  return (
    <div>
      <NumberField label={t.completedCities} value={cities} onChange={setCities} />
      {bridgesCastlesBazaars && (
        <NumberField
          label={`${FEATURE_EMOJI.castle} ${t.featureNames.castle}`}
          value={castles}
          onChange={setCastles}
          min={0}
        />
      )}
      {tradersBuilders && (
        <Toggle label={`${PIG_EMOJI} ${t.pig}`} checked={pig} onChange={setPig} />
      )}
      <p className="mt-1 text-xs text-white/40">{t.fieldHint}</p>
      <ApplyBar
        amount={scoreField(cities, pig, castles)}
        desc={{ kind: 'field', cities, pig, castles }}
        onApply={onApply}
      />
    </div>
  )
}

function CastleForm({
  onApply,
  recentFeatures,
}: {
  onApply: ApplyFn
  recentFeatures: CastleEntry[]
}) {
  const { t, lang } = useI18n()
  const [value, setValue] = useState(4)
  return (
    <div>
      <NumberField label={t.castleValue} value={value} onChange={setValue} min={0} />
      <p className="mt-1 text-xs text-white/40">{t.castleHint}</p>
      <ApplyBar amount={scoreCastle(value)} desc={{ kind: 'castle', value }} onApply={onApply} />

      {recentFeatures.length > 0 && (
        <div className="mt-4">
          <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-white/40">
            {t.useRecentScore}
          </h4>
          <ul className="space-y-1.5">
            {recentFeatures.map((e) => (
              <li key={e.id}>
                <button
                  onClick={() => onApply(e.amount, { kind: 'castle', value: e.amount })}
                  className="flex w-full items-center gap-2.5 rounded-lg bg-white/5 px-3 py-2 text-left text-sm transition hover:bg-white/10 active:scale-[0.99]"
                >
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: e.playerColor }}
                  />
                  <span className="font-medium">{e.playerName}</span>
                  <span className="min-w-0 flex-1 truncate text-white/50">
                    {formatDescriptor(e.desc, lang)}
                  </span>
                  <span className="shrink-0 font-bold tabular-nums text-emerald-400">
                    +{e.amount}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

function MessageForm({ onApply }: { onApply: ApplyFn }) {
  const { t } = useI18n()
  const [points, setPoints] = useState(2)
  return (
    <div>
      <NumberField label={t.points} value={points} onChange={setPoints} min={0} />
      <p className="mt-1 text-xs text-white/40">{t.messageHint}</p>
      <ApplyBar
        amount={scoreMessage(points)}
        desc={{ kind: 'message', points }}
        onApply={onApply}
      />
    </div>
  )
}

function CircusForm({ onApply }: { onApply: ApplyFn }) {
  const { t } = useI18n()
  const [animal, setAnimal] = useState<CircusAnimal>('seal')
  const [meeples, setMeeples] = useState(1)
  const animals: CircusAnimal[] = [
    'elephant',
    'tiger',
    'bear',
    'seal',
    'monkey',
    'flea',
  ]
  return (
    <div>
      <div className="mb-3 grid grid-cols-3 gap-1.5">
        {animals.map((a) => (
          <button
            key={a}
            onClick={() => setAnimal(a)}
            aria-label={t.animalNames[a]}
            className={`flex flex-col items-center gap-0.5 rounded-lg py-2 text-xs font-bold transition ${
              animal === a
                ? 'bg-amber-500 text-gray-900'
                : 'bg-white/5 text-white/70 hover:bg-white/10'
            }`}
          >
            <span className="text-xl leading-none">{ANIMAL_EMOJI[a]}</span>
            {ANIMAL_VALUE[a]}
          </button>
        ))}
      </div>
      <NumberField label={t.meeples} value={meeples} onChange={setMeeples} min={1} />
      <p className="mt-1 text-xs text-white/40">{t.circusHint}</p>
      <ApplyBar
        amount={scoreCircus(animal, meeples)}
        desc={{ kind: 'circus', animal, meeples }}
        onApply={onApply}
      />
    </div>
  )
}

function AcrobatsForm({ onApply }: { onApply: ApplyFn }) {
  const { t } = useI18n()
  const [count, setCount] = useState(1)
  return (
    <div>
      <NumberField label={t.acrobatsCount} value={count} onChange={setCount} min={1} />
      <p className="mt-1 text-xs text-white/40">{t.acrobatsHint}</p>
      <ApplyBar
        amount={scoreAcrobats(count)}
        desc={{ kind: 'acrobats', count }}
        onApply={onApply}
      />
    </div>
  )
}

function RingmasterForm({ onApply }: { onApply: ApplyFn }) {
  const { t } = useI18n()
  const [tiles, setTiles] = useState(1)
  return (
    <div>
      <NumberField
        label={t.ringmasterTiles}
        value={tiles}
        onChange={setTiles}
        min={0}
      />
      <p className="mt-1 text-xs text-white/40">{t.ringmasterHint}</p>
      <ApplyBar
        amount={scoreRingmaster(tiles)}
        desc={{ kind: 'ringmaster', tiles }}
        onApply={onApply}
      />
    </div>
  )
}

function GoodsForm({
  onRecord,
  tradersBuilders,
  goldMines,
}: {
  onRecord: (delta: TokenDelta) => void
  tradersBuilders: boolean
  goldMines: boolean
}) {
  const { t } = useI18n()
  const [wine, setWine] = useState(0)
  const [grain, setGrain] = useState(0)
  const [cloth, setCloth] = useState(0)
  const [gold, setGold] = useState(0)
  const total = wine + grain + cloth + gold

  return (
    <div>
      {tradersBuilders && (
        <>
          <NumberField label={`${GOODS_EMOJI.wine} ${t.goodNames.wine}`} value={wine} onChange={setWine} />
          <NumberField label={`${GOODS_EMOJI.grain} ${t.goodNames.grain}`} value={grain} onChange={setGrain} />
          <NumberField label={`${GOODS_EMOJI.cloth} ${t.goodNames.cloth}`} value={cloth} onChange={setCloth} />
        </>
      )}
      {tradersBuilders && goldMines && (
        <div className="my-2 border-t border-white/10" />
      )}
      {goldMines && (
        <NumberField label={`${FEATURE_EMOJI.gold} ${t.goldIngots}`} value={gold} onChange={setGold} />
      )}
      <p className="mt-1 text-xs text-white/40">{t.goodsTabHint}</p>
      <button
        disabled={total === 0}
        onClick={() => onRecord({ wine, grain, cloth, gold })}
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
