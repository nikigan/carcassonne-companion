import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type {
  GameState,
  Player,
  ScoreDescriptor,
  TokenDelta,
  TradeGoods,
} from '../types'
import { contrastText } from '../colors'
import { formatDescriptor, useI18n } from '../i18n'
import { FEATURE_EMOJI, GOODS_EMOJI } from '../scoring'
import { ScoreModal } from './ScoreModal'

interface Props {
  state: GameState
  onScore: (playerId: string, amount: number, desc: ScoreDescriptor) => void
  onRecordTokens: (playerId: string, delta: TokenDelta) => void
  onUndo: (entryId: string) => void
}

/** Delay (ms) before the leaderboard re-sorts after a score change. */
const RESORT_DELAY = 3000

/**
 * Score-log kinds a castle can take its value from: completed features, plus
 * another castle (a scored castle can itself trigger an adjacent one).
 */
const FEATURE_DESC_KINDS = new Set(['road', 'city', 'cloister', 'field', 'castle'])

const prefersReducedMotion = () =>
  typeof window !== 'undefined' &&
  window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

function sortedIds(players: Player[]): string[] {
  return [...players].sort((a, b) => b.score - a.score).map((p) => p.id)
}

/** The in-game view: ranked player cards + quick actions + score log. */
export function Scoreboard({ state, onScore, onRecordTokens, onUndo }: Props) {
  const { t, lang } = useI18n()
  const [activeId, setActiveId] = useState<string | null>(null)
  const active = state.players.find((p) => p.id === activeId) ?? null

  // Display order lags behind the true ranking: it re-sorts only after scores
  // have been quiet for RESORT_DELAY, so the list doesn't jump on every tap.
  const [orderIds, setOrderIds] = useState<string[]>(() => sortedIds(state.players))

  useEffect(() => {
    const target = sortedIds(state.players)
    const currentSet = new Set(orderIds)
    const targetSet = new Set(target)
    const membershipChanged =
      orderIds.length !== target.length ||
      target.some((id) => !currentSet.has(id))

    // Players added/removed (e.g. via "Edit players") — reconcile immediately.
    if (membershipChanged || orderIds.some((id) => !targetSet.has(id))) {
      setOrderIds(target)
      return
    }

    // Same players, but a score may have changed: debounce the re-sort.
    if (orderIds.every((id, i) => id === target[i])) return
    const timer = setTimeout(() => setOrderIds(target), RESORT_DELAY)
    return () => clearTimeout(timer)
  }, [state.players, orderIds])

  const orderedPlayers = orderIds
    .map((id) => state.players.find((p) => p.id === id))
    .filter((p): p is Player => Boolean(p))

  // Crown the current leader by actual score, even before the list settles.
  const leadScore = state.players.reduce((m, p) => Math.max(m, p.score), 0)

  // FLIP animation: slide each card from its previous position to the new one
  // whenever the display order changes.
  const cardRefs = useRef<Map<string, HTMLDivElement>>(new Map())
  const prevTops = useRef<Map<string, number>>(new Map())

  useLayoutEffect(() => {
    const refs = cardRefs.current
    const nextTops = new Map<string, number>()
    refs.forEach((el, id) => nextTops.set(id, el.getBoundingClientRect().top))

    if (!prefersReducedMotion()) {
      refs.forEach((el, id) => {
        const prev = prevTops.current.get(id)
        const next = nextTops.get(id)
        if (prev == null || next == null || prev === next) return
        // Invert: jump back to the old spot with no transition…
        el.style.transition = 'none'
        el.style.transform = `translateY(${prev - next}px)`
        // …then play: animate to the natural position on the next frame.
        requestAnimationFrame(() => {
          el.style.transition = 'transform 350ms cubic-bezier(0.2, 0, 0, 1)'
          el.style.transform = ''
        })
      })
    }

    prevTops.current = nextTops
  }, [orderIds])

  const nameById = (id: string) =>
    state.players.find((p) => p.id === id)?.name ?? 'Unknown'
  const colorById = (id: string) =>
    state.players.find((p) => p.id === id)?.color ?? '#666'

  // Recent feature scores a castle can borrow its value from: completed
  // road/city/monastery/field entries (positive points), newest 5.
  const recentFeatures = state.log
    .filter((e) => FEATURE_DESC_KINDS.has(e.desc.kind) && e.amount > 0)
    .slice(0, 5)
    .map((e) => ({
      id: e.id,
      amount: e.amount,
      desc: e.desc,
      playerName: nameById(e.playerId),
      playerColor: colorById(e.playerId),
    }))

  return (
    <div className="mx-auto w-full max-w-md px-4 pb-10 pt-4 md:max-w-5xl md:grid md:grid-cols-2 md:items-start md:gap-6">
      <div className="space-y-2.5 md:sticky md:top-[calc(var(--app-header-h,4.5rem)_+_1rem)]">
        {orderedPlayers.map((p, i) => {
          const isLeader = p.score === leadScore && leadScore > 0
          return (
            <div
              key={p.id}
              ref={(el) => {
                if (el) cardRefs.current.set(p.id, el)
                else cardRefs.current.delete(p.id)
              }}
              className="flex items-center gap-3 rounded-2xl bg-white/5 p-3 will-change-transform"
            >
              <span className="w-5 text-center text-sm font-bold text-white/40">
                {i + 1}
              </span>
              <span
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-lg font-bold"
                style={{ backgroundColor: p.color, color: contrastText(p.color) }}
              >
                {p.name.charAt(0).toUpperCase() || '?'}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 truncate font-semibold">
                  {p.name}
                  {isLeader && <span title={t.leadingTitle}>👑</span>}
                </div>
                <div className="text-3xl font-black tabular-nums leading-tight">
                  {p.score}
                </div>
                <GoodsRow goods={p.goods} gold={p.gold} />
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => onScore(p.id, -1, { kind: 'manual', amount: -1 })}
                  className="h-10 w-10 rounded-xl bg-white/10 text-xl font-bold hover:bg-white/20 active:scale-95"
                  aria-label={t.subtractAria(p.name)}
                >
                  −
                </button>
                <button
                  onClick={() => onScore(p.id, 1, { kind: 'manual', amount: 1 })}
                  className="h-10 w-10 rounded-xl bg-white/10 text-xl font-bold hover:bg-white/20 active:scale-95"
                  aria-label={t.addPointAria(p.name)}
                >
                  +
                </button>
                <button
                  onClick={() => setActiveId(p.id)}
                  className="h-10 rounded-xl bg-amber-500 px-3 text-sm font-bold text-gray-900 hover:bg-amber-400 active:scale-95"
                >
                  {t.scoreBtn}
                </button>
              </div>
            </div>
          )
        })}
      </div>

      <div className="mt-8 md:mt-0">
        <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-white/40">
          {t.scoreLog}
        </h3>
        {state.log.length === 0 ? (
          <p className="rounded-xl border border-dashed border-white/10 p-4 text-center text-sm text-white/30">
            {t.noPointsYet}
          </p>
        ) : (
          <ul className="space-y-1.5">
            {state.log.slice(0, 50).map((e) => (
              <li
                key={e.id}
                className="flex items-center gap-2.5 rounded-lg bg-white/5 px-3 py-2 text-sm"
              >
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: colorById(e.playerId) }}
                />
                <span className="font-medium">{nameById(e.playerId)}</span>
                <span className="min-w-0 flex-1 truncate text-white/50">
                  {formatDescriptor(e.desc, lang)}
                </span>
                <span
                  className={`shrink-0 font-bold tabular-nums ${
                    e.amount >= 0 ? 'text-emerald-400' : 'text-red-400'
                  }`}
                >
                  {e.amount > 0 ? '+' : ''}
                  {e.amount}
                </span>
                <button
                  onClick={() => onUndo(e.id)}
                  className="shrink-0 rounded px-1.5 py-0.5 text-xs text-white/40 hover:bg-white/10 hover:text-white/80"
                  aria-label={t.undoAria}
                >
                  {t.undo}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {active && (
        <ScoreModal
          player={active}
          recentFeatures={recentFeatures}
          expansions={state.expansions}
          onClose={() => setActiveId(null)}
          onScore={(amount, desc) => onScore(active.id, amount, desc)}
          onRecordTokens={(delta) => onRecordTokens(active.id, delta)}
        />
      )}
    </div>
  )
}

/** Compact token tally (trade goods + gold) shown under a player's score. */
function GoodsRow({ goods, gold }: { goods: TradeGoods; gold: number }) {
  const hasGoods = goods.wine + goods.grain + goods.cloth > 0
  if (!hasGoods && gold === 0) return null
  return (
    <div className="mt-0.5 flex flex-wrap gap-x-2 text-xs text-white/50">
      {hasGoods && (
        <>
          <span>
            {GOODS_EMOJI.wine} {goods.wine}
          </span>
          <span>
            {GOODS_EMOJI.grain} {goods.grain}
          </span>
          <span>
            {GOODS_EMOJI.cloth} {goods.cloth}
          </span>
        </>
      )}
      {gold > 0 && (
        <span>
          {FEATURE_EMOJI.gold} {gold}
        </span>
      )}
    </div>
  )
}
