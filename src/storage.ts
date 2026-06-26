import type { GameState, Player, ScoreEntry } from './types'
import { emptyGoods } from './types'
import { ALL_ON, normalizeConfig } from './expansions'
import { emptyGame } from './game/reducer'
export { emptyGame }

const STORAGE_KEY = 'carcassonne-companion:game'

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
      // Saves predating the expansion config had every feature available, so
      // default a missing config to all-on to preserve that game's UI.
      expansions: normalizeConfig(parsed.expansions, ALL_ON),
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

// --- Room mode storage -----------------------------------------------------
// The code of the room we're currently in (so a reload rejoins it), plus a
// per-room cache of the last displayed state for an instant paint on rejoin.
// Solo play keeps using STORAGE_KEY above and never touches these.

const ACTIVE_ROOM_KEY = 'carcassonne-companion:active-room'
const roomKey = (code: string) => `carcassonne-companion:room:${code}`
const hostKey = (code: string) => `carcassonne-companion:host:${code}`

export function loadActiveRoom(): string | null {
  try { return localStorage.getItem(ACTIVE_ROOM_KEY) } catch { return null }
}

export function saveActiveRoom(code: string | null): void {
  try {
    if (code) localStorage.setItem(ACTIVE_ROOM_KEY, code)
    else localStorage.removeItem(ACTIVE_ROOM_KEY)
  } catch { /* ignore */ }
}

export function loadRoomCache(code: string): GameState | null {
  try {
    const raw = localStorage.getItem(roomKey(code))
    return raw ? (JSON.parse(raw) as GameState) : null
  } catch { return null }
}

export function saveRoomCache(code: string, state: GameState): void {
  try { localStorage.setItem(roomKey(code), JSON.stringify(state)) } catch { /* ignore */ }
}

export function clearRoomCache(code: string): void {
  try { localStorage.removeItem(roomKey(code)) } catch { /* ignore */ }
}

// The creator's host token for a room. Kept per-room (never cleared on leave)
// so a returning creator who rejoins regains host. The absence of a token is
// how a fresh joiner is identified as a non-host.

export function loadHostToken(code: string): string | null {
  try { return localStorage.getItem(hostKey(code)) } catch { return null }
}

export function saveHostToken(code: string, token: string): void {
  try { localStorage.setItem(hostKey(code), token) } catch { /* ignore */ }
}

/**
 * Bring a stored log entry up to the current shape. Earlier versions stored a
 * pre-rendered `label` string instead of a structured `desc`; fall back to a
 * manual descriptor so old saves keep working. Field descriptors gained a
 * `castles` count later — backfill 0 so old labels don't render `undefined`.
 * Road/city descriptors gained a `magic` figure (Mage & Witch) — backfill
 * 'none' so old labels don't render `undefined`.
 */
function migrateEntry(entry: ScoreEntry): ScoreEntry {
  if (!entry.desc) {
    return { ...entry, desc: { kind: 'manual', amount: entry.amount } }
  }
  if (entry.desc.kind === 'field' && entry.desc.castles == null) {
    return { ...entry, desc: { ...entry.desc, castles: 0 } }
  }
  if (
    (entry.desc.kind === 'road' || entry.desc.kind === 'city') &&
    entry.desc.magic == null
  ) {
    return { ...entry, desc: { ...entry.desc, magic: 'none' } }
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
