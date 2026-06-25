export interface Player {
  id: string
  name: string
  /** Hex color string, e.g. "#D33A2C" */
  color: string
  score: number
}

export interface ScoreEntry {
  id: string
  playerId: string
  amount: number
  /** Human-readable description of what was scored, e.g. "City (4 tiles, 1 pennant)" */
  label: string
  timestamp: number
}

export interface GameState {
  players: Player[]
  log: ScoreEntry[]
  /** Whether the game has started (players locked in and scoring begun). */
  started: boolean
}
