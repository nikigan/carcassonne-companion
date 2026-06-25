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
 * manual descriptor so old saves keep working.
 */
function migrateEntry(entry: ScoreEntry): ScoreEntry {
  if (entry.desc) return entry
  return { ...entry, desc: { kind: 'manual', amount: entry.amount } }
}

/** Ensure players from older saves have a trade-goods tally. */
function migratePlayer(player: Player): Player {
  if (player.goods) return player
  return { ...player, goods: emptyGoods() }
}

/** Small, dependency-free unique id generator. */
export function uid(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36)
}
