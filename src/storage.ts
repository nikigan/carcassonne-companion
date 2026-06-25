import type { GameState } from './types'

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
    return {
      players: parsed.players,
      log: Array.isArray(parsed.log) ? parsed.log : [],
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

/** Small, dependency-free unique id generator. */
export function uid(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36)
}
