export type GoodType = 'wine' | 'grain' | 'cloth'

/** Traders & Builders trade-goods tokens collected by a player. */
export interface TradeGoods {
  wine: number
  grain: number
  cloth: number
}

export const emptyGoods = (): TradeGoods => ({ wine: 0, grain: 0, cloth: 0 })

export interface Player {
  id: string
  name: string
  /** Hex color string, e.g. "#D33A2C" */
  color: string
  score: number
  /** Trade goods collected (Traders & Builders). */
  goods: TradeGoods
}

/**
 * Structured description of a single scoring action. Stored instead of a
 * pre-rendered string so the score log can be re-localized on the fly when the
 * language changes.
 */
export type ScoreDescriptor =
  | { kind: 'road'; tiles: number; completed: boolean; inn: boolean }
  | {
      kind: 'city'
      tiles: number
      pennants: number
      completed: boolean
      cathedral: boolean
    }
  | { kind: 'cloister'; surrounding: number; completed: boolean }
  | { kind: 'field'; cities: number; pig: boolean }
  | { kind: 'castle'; value: number }
  | { kind: 'gold'; ingots: number }
  | { kind: 'message'; points: number }
  | { kind: 'goodsBonus'; good: GoodType }
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
