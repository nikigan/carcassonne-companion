import type { ExpansionConfig } from './expansions'

export type GoodType = 'wine' | 'grain' | 'cloth'

/** Mage & Witch: the magic figure sitting on a road/city when it scores. */
export type MagicFigure = 'none' | 'mage' | 'witch'

/** Circus & Artists: the animal token revealed at the Big Top. */
export type CircusAnimal =
  | 'elephant'
  | 'tiger'
  | 'bear'
  | 'seal'
  | 'monkey'
  | 'flea'

/** Traders & Builders trade-goods tokens collected by a player. */
export interface TradeGoods {
  wine: number
  grain: number
  cloth: number
}

export const emptyGoods = (): TradeGoods => ({ wine: 0, grain: 0, cloth: 0 })

/** Collected tokens to add to a player: trade goods and/or gold ingots. */
export interface TokenDelta {
  wine?: number
  grain?: number
  cloth?: number
  gold?: number
}

export interface Player {
  id: string
  name: string
  /** Hex color string, e.g. "#D33A2C" */
  color: string
  score: number
  /** Trade goods collected (Traders & Builders). */
  goods: TradeGoods
  /** Gold ingots collected (Gold Mines). */
  gold: number
}

/**
 * Structured description of a single scoring action. Stored instead of a
 * pre-rendered string so the score log can be re-localized on the fly when the
 * language changes.
 */
export type ScoreDescriptor =
  | {
      kind: 'road'
      tiles: number
      completed: boolean
      inn: boolean
      magic: MagicFigure
    }
  | {
      kind: 'city'
      tiles: number
      pennants: number
      completed: boolean
      cathedral: boolean
      magic: MagicFigure
    }
  | { kind: 'cloister'; surrounding: number; completed: boolean }
  | { kind: 'field'; cities: number; pig: boolean; castles: number }
  | { kind: 'castle'; value: number }
  | { kind: 'gold'; ingots: number }
  | { kind: 'message'; points: number }
  | { kind: 'circus'; animal: CircusAnimal; meeples: number }
  | { kind: 'acrobats'; count: number }
  | { kind: 'ringmaster'; tiles: number }
  | { kind: 'fairy'; bonus: 1 | 3 }
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
  /** Which expansions are active — gates the scoring UI. */
  expansions: ExpansionConfig
}
