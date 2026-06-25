export interface Player {
  id: string
  name: string
  /** Hex color string, e.g. "#D33A2C" */
  color: string
  score: number
}

/**
 * Structured description of a single scoring action. Stored instead of a
 * pre-rendered string so the score log can be re-localized on the fly when the
 * language changes.
 */
export type ScoreDescriptor =
  | { kind: 'road'; tiles: number }
  | { kind: 'city'; tiles: number; pennants: number; completed: boolean }
  | { kind: 'cloister'; surrounding: number; completed: boolean }
  | { kind: 'field'; cities: number }
  | { kind: 'manual'; amount: number }

export interface ScoreEntry {
  id: string
  playerId: string
  amount: number
  /** What was scored. Formatted for display via the active language. */
  desc: ScoreDescriptor
  timestamp: number
}

export interface GameState {
  players: Player[]
  log: ScoreEntry[]
  /** Whether the game has started (players locked in and scoring begun). */
  started: boolean
}
