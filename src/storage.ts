import type { GameState, Player, ScoreEntry } from './types'
import { emptyGoods } from './types'

const STORAGE_KEY = 'carcassonne-companion:game'

export const emptyGame: GameState = {
  players: [],
  log: [],
  started: false,
}

export function loadGame(): GameState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return emptyGame
    const parsed = JSON.parse(raw) as Partial<GameState>
    if (!parsed || !Array.isArray(parsed.players)) return emptyGame
    const log = Array.isArray(parsed.log) ? parsed.log.map(migrateEntry) : []
    return {
      players: parsed.players.map(migratePlayer),
      log,
      started: Boolean(parsed.started),
    }
  } catch {
    return emptyGame
  }
}

export function saveGame(state: GameState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    // Ignore quota / unavailable storage errors — the app still works in-memory.
  }
}

export function clearGame(): void {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    // ignore
  }
}

/**
 * Bring a stored log entry up to the current shape. Earlier versions stored a
 * pre-rendered `label` string instead of a structured `desc`; fall back to a
 * manual descriptor so old saves keep working. Field descriptors gained a
 * `castles` count later — backfill 0 so old labels don't render `undefined`.
 */
function migrateEntry(entry: ScoreEntry): ScoreEntry {
  if (!entry.desc) {
    return { ...entry, desc: { kind: 'manual', amount: entry.amount } }
  }
  if (entry.desc.kind === 'field' && entry.desc.castles == null) {
    return { ...entry, desc: { ...entry.desc, castles: 0 } }
  }
  return entry
}

/** Ensure players from older saves have trade-goods and gold tallies. */
function migratePlayer(player: Player): Player {
  return {
    ...player,
    goods: player.goods ?? emptyGoods(),
    gold: player.gold ?? 0,
  }
}

/** Small, dependency-free unique id generator. */
export function uid(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36)
}
