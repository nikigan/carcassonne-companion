import type {
  GameState, GoodType, Player, ScoreDescriptor, ScoreEntry, TokenDelta,
} from '../types'
import { emptyGoods } from '../types'
import type { ExpansionId } from '../expansions'
import { BASE_ONLY } from '../expansions'
import { GOODS_MAJORITY_BONUS, scoreGold } from '../scoring'

/** Fresh empty game (base game only). Lives here so the pure reducer and the
 *  browser-only storage layer can both use it without a circular import. */
export const emptyGame: GameState = {
  players: [], log: [], started: false, expansions: BASE_ONLY,
}

const GOOD_TYPES: GoodType[] = ['wine', 'grain', 'cloth']

/** Rapid manual changes within this window coalesce into one log entry. */
export const MANUAL_MERGE_WINDOW = 3000

/**
 * Every game mutation, as a serializable action. Impure values (new ids,
 * timestamps) travel in the payload so the reducer stays pure and deterministic
 * on both client and server. Multi-entry actions derive child ids as `${id}-${i}`.
 */
export type GameAction =
  | { type: 'addPlayer'; id: string; name: string; color: string }
  | { type: 'updatePlayer'; id: string; patch: Partial<Pick<Player, 'name' | 'color'>> }
  | { type: 'removePlayer'; id: string }
  | { type: 'startGame' }
  | { type: 'editPlayers' }
  | { type: 'setExpansion'; expansion: ExpansionId; on: boolean }
  | { type: 'addScore'; id: string; playerId: string; amount: number; desc: ScoreDescriptor; timestamp: number }
  | { type: 'recordTokens'; playerId: string; delta: TokenDelta }
  | { type: 'scoreTradeGoods'; id: string; timestamp: number }
  | { type: 'scoreGoldIngots'; id: string; timestamp: number }
  | { type: 'undoEntry'; entryId: string }
  | { type: 'resetScores' }
  | { type: 'newGame' }

function applyManual(
  s: GameState, playerId: string, amount: number, now: number, newId: string,
): GameState {
  const players = s.players.map((p) =>
    p.id === playerId ? { ...p, score: p.score + amount } : p,
  )
  const open = s.log.find((e) => e.playerId === playerId && e.desc.kind === 'manual')
  if (open && now - open.timestamp < MANUAL_MERGE_WINDOW) {
    const net = open.amount + amount
    if (net === 0) return { ...s, players, log: s.log.filter((e) => e.id !== open.id) }
    const merged: ScoreEntry = { ...open, amount: net, desc: { kind: 'manual', amount: net }, timestamp: now }
    return { ...s, players, log: s.log.map((e) => (e.id === open.id ? merged : e)) }
  }
  const entry: ScoreEntry = { id: newId, playerId, amount, desc: { kind: 'manual', amount }, timestamp: now }
  return { ...s, players, log: [entry, ...s.log] }
}

/** Pure, total reducer. Unknown actions return state unchanged. */
export function applyAction(s: GameState, action: GameAction): GameState {
  switch (action.type) {
    case 'addPlayer':
      return {
        ...s,
        players: [...s.players, {
          id: action.id,
          name: action.name.trim() || `#${s.players.length + 1}`,
          color: action.color, score: 0, goods: emptyGoods(), gold: 0,
        }],
      }
    case 'updatePlayer':
      return { ...s, players: s.players.map((p) => (p.id === action.id ? { ...p, ...action.patch } : p)) }
    case 'removePlayer':
      return {
        ...s,
        players: s.players.filter((p) => p.id !== action.id),
        log: s.log.filter((e) => e.playerId !== action.id),
      }
    case 'startGame':
      return s.players.length > 0 ? { ...s, started: true } : s
    case 'editPlayers':
      return { ...s, started: false }
    case 'setExpansion':
      return { ...s, expansions: { ...s.expansions, [action.expansion]: action.on } }
    case 'addScore': {
      if (!Number.isFinite(action.amount) || action.amount === 0) return s
      if (action.desc.kind === 'manual') {
        return applyManual(s, action.playerId, action.amount, action.timestamp, action.id)
      }
      const entry: ScoreEntry = {
        id: action.id, playerId: action.playerId, amount: action.amount,
        desc: action.desc, timestamp: action.timestamp,
      }
      return {
        ...s,
        players: s.players.map((p) => (p.id === action.playerId ? { ...p, score: p.score + action.amount } : p)),
        log: [entry, ...s.log],
      }
    }
    case 'recordTokens':
      return {
        ...s,
        players: s.players.map((p) => p.id === action.playerId ? {
          ...p,
          goods: {
            wine: p.goods.wine + (action.delta.wine ?? 0),
            grain: p.goods.grain + (action.delta.grain ?? 0),
            cloth: p.goods.cloth + (action.delta.cloth ?? 0),
          },
          gold: p.gold + (action.delta.gold ?? 0),
        } : p),
      }
    case 'scoreGoldIngots': {
      const entries: ScoreEntry[] = []
      s.players.forEach((p) => {
        if (p.gold <= 0) return
        entries.push({
          id: `${action.id}-${entries.length}`, playerId: p.id,
          amount: scoreGold(p.gold), desc: { kind: 'gold', ingots: p.gold }, timestamp: action.timestamp,
        })
      })
      if (entries.length === 0) return s
      const byPlayer = new Map(entries.map((e) => [e.playerId, e.amount]))
      return {
        ...s,
        players: s.players.map((p) => ({ ...p, score: p.score + (byPlayer.get(p.id) ?? 0), gold: 0 })),
        log: [...entries, ...s.log],
      }
    }
    case 'scoreTradeGoods': {
      const bonus: Record<string, number> = {}
      const entries: ScoreEntry[] = []
      for (const good of GOOD_TYPES) {
        const max = s.players.reduce((m, p) => Math.max(m, p.goods[good]), 0)
        if (max <= 0) continue
        for (const p of s.players) {
          if (p.goods[good] !== max) continue
          bonus[p.id] = (bonus[p.id] ?? 0) + GOODS_MAJORITY_BONUS
          entries.push({
            id: `${action.id}-${entries.length}`, playerId: p.id,
            amount: GOODS_MAJORITY_BONUS, desc: { kind: 'goodsBonus', good }, timestamp: action.timestamp,
          })
        }
      }
      if (entries.length === 0) return s
      return {
        ...s,
        players: s.players.map((p) => ({ ...p, score: p.score + (bonus[p.id] ?? 0), goods: emptyGoods() })),
        log: [...entries, ...s.log],
      }
    }
    case 'undoEntry': {
      const entry = s.log.find((e) => e.id === action.entryId)
      if (!entry) return s
      return {
        ...s,
        players: s.players.map((p) => (p.id === entry.playerId ? { ...p, score: p.score - entry.amount } : p)),
        log: s.log.filter((e) => e.id !== action.entryId),
      }
    }
    case 'resetScores':
      return {
        ...s,
        players: s.players.map((p) => ({ ...p, score: 0, goods: emptyGoods(), gold: 0 })),
        log: [],
      }
    case 'newGame':
      return { ...emptyGame, expansions: s.expansions }
    default:
      // Exhaustiveness: adding a GameAction variant without a case makes
      // `action` non-`never` here and fails the build (no unused local, so
      // noUnusedLocals stays happy).
      action satisfies never
      return s
  }
}
