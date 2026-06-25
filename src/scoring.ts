import type { GoodType } from './types'

/**
 * Carcassonne scoring math (base game + Inns & Cathedrals, Traders & Builders,
 * and the Castle from Bridges, Castles & Bazaars). These compute point values
 * only; human-readable labels are produced by the i18n layer from a
 * ScoreDescriptor so they can be localized.
 */

export type FeatureType =
  | 'road'
  | 'city'
  | 'cloister'
  | 'field'
  | 'castle'
  | 'gold'
  | 'message'

/** Emoji shown for each game feature (and for manual adjustments). */
export const FEATURE_EMOJI: Record<FeatureType | 'manual', string> = {
  road: '🛣️',
  city: '🏰',
  cloister: '⛪',
  field: '🌾',
  castle: '🏯',
  gold: '🪙',
  message: '📜',
  manual: '✏️',
}

/** Emoji for expansion modifiers. */
export const INN_EMOJI = '🍺'
export const CATHEDRAL_EMOJI = '✝️'
export const PIG_EMOJI = '🐷'

/** Trade-goods tokens (Traders & Builders). */
export const GOODS_EMOJI: Record<GoodType, string> = {
  wine: '🛢️',
  grain: '🌾',
  cloth: '🧣',
}

/** Points awarded to each player holding the majority of a trade good. */
export const GOODS_MAJORITY_BONUS = 10

/** Points per gold ingot at game end (Gold Mines). */
export const GOLD_PER_INGOT = 3

const clamp = (n: number) => Math.max(0, Math.floor(n))

/**
 * Road: 1 point per tile. With an inn (Inns & Cathedrals) a *completed* road
 * is worth 2 per tile, but an incomplete one (game end) scores nothing.
 */
export function scoreRoad(tiles: number, completed: boolean, inn: boolean): number {
  const t = clamp(tiles)
  if (inn) return completed ? 2 * t : 0
  return t
}

/**
 * City: completed = 2 per tile + 2 per pennant; incomplete (game end) = 1 each.
 * With a cathedral (Inns & Cathedrals) a *completed* city is worth 3 per tile
 * and 3 per pennant, but an incomplete one scores nothing.
 */
export function scoreCity(
  tiles: number,
  pennants: number,
  completed: boolean,
  cathedral: boolean,
): number {
  const units = clamp(tiles) + clamp(pennants)
  if (cathedral) return completed ? 3 * units : 0
  return completed ? 2 * units : units
}

/**
 * Cloister: 1 point for the cloister tile + 1 per surrounding tile.
 * A completed cloister (all 8 neighbors) is worth 9.
 */
export function scoreCloister(surrounding: number, completed: boolean): number {
  if (completed) return 9
  return 1 + Math.min(8, clamp(surrounding))
}

/**
 * Field (game end): 3 points for each completed city the field borders, or 4
 * if the player has a pig in that field (Traders & Builders).
 */
export function scoreField(cities: number, pig: boolean): number {
  return clamp(cities) * (pig ? 4 : 3)
}

/** Castle (Bridges, Castles & Bazaars): scores the value of the feature that triggered it. */
export function scoreCastle(value: number): number {
  return clamp(value)
}

/** Gold Mines: each collected gold ingot is worth 3 points. */
export function scoreGold(ingots: number): number {
  return clamp(ingots) * GOLD_PER_INGOT
}

/** The Messages: points received from a message tile (entered directly). */
export function scoreMessage(points: number): number {
  return clamp(points)
}
