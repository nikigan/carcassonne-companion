import type { CircusAnimal, GoodType, MagicFigure } from './types'

/**
 * Carcassonne scoring math (base game + Inns & Cathedrals, Traders & Builders,
 * the Castle from Bridges, Castles & Bazaars, Gold Mines, The Messages, the
 * Mage & Witch, and Circus & Artists). These compute point values only;
 * human-readable labels are produced by the i18n layer from a ScoreDescriptor
 * so they can be localized.
 */

export type FeatureType =
  | 'road'
  | 'city'
  | 'cloister'
  | 'field'
  | 'castle'
  | 'gold'
  | 'message'
  | 'circus'
  | 'acrobats'
  | 'ringmaster'

/** Emoji shown for each game feature (and for manual adjustments). */
export const FEATURE_EMOJI: Record<FeatureType | 'manual', string> = {
  road: '🛣️',
  city: '🏰',
  cloister: '⛪',
  field: '🌾',
  castle: '🏯',
  gold: '🟨',
  message: '📜',
  circus: '🎪',
  acrobats: '🤸',
  ringmaster: '🎩',
  manual: '✏️',
}

/** Emoji for expansion modifiers. */
export const INN_EMOJI = '🍺'
export const CATHEDRAL_EMOJI = '✝️'
export const PIG_EMOJI = '🐷'
export const MAGE_EMOJI = '🧙'
export const WITCH_EMOJI = '🧹'

/** Trade-goods tokens (Traders & Builders). */
export const GOODS_EMOJI: Record<GoodType, string> = {
  wine: '🛢️',
  grain: '🌾',
  cloth: '🧣',
}

/** Points awarded to each player holding the majority of a trade good. */
export const GOODS_MAJORITY_BONUS = 10

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
 * if the player has a pig in that field (Traders & Builders). Each adjacent
 * castle (Bridges, Castles & Bazaars) adds a flat 1 point.
 */
export function scoreField(cities: number, pig: boolean, castles: number): number {
  return clamp(cities) * (pig ? 4 : 3) + clamp(castles)
}

/** Castle (Bridges, Castles & Bazaars): scores the value of the feature that triggered it. */
export function scoreCastle(value: number): number {
  return clamp(value)
}

/**
 * Gold Mines: gold scores progressively — the more ingots a player has, the
 * more each one is worth (1–3 bars: 1 each, 4–6: 2, 7–9: 3, 10+: 4).
 */
export function goldRate(ingots: number): number {
  const n = clamp(ingots)
  if (n >= 10) return 4
  if (n >= 7) return 3
  if (n >= 4) return 2
  return 1
}

export function scoreGold(ingots: number): number {
  return clamp(ingots) * goldRate(ingots)
}

/** The Messages: points received from a message tile (entered directly). */
export function scoreMessage(points: number): number {
  return clamp(points)
}

/* ------------------------------------------------------------------ *
 * The Mage & The Witch
 * ------------------------------------------------------------------ */

/**
 * Apply a magic figure to a road/city's base score. The mage adds 1 point per
 * tile in the feature (pennants excluded); the witch halves the feature's final
 * points, rounded up in the player's favor. Roads and cities only — the figures
 * can never sit on a monastery or field, and never both on one feature.
 */
export function applyMagic(base: number, tiles: number, magic: MagicFigure): number {
  if (magic === 'mage') return clamp(base) + clamp(tiles)
  if (magic === 'witch') return Math.ceil(clamp(base) / 2)
  return clamp(base)
}

/* ------------------------------------------------------------------ *
 * Circus & Artists
 * ------------------------------------------------------------------ */

/** Animal-token values shown at the Big Top (no animal is worth 2). */
export const ANIMAL_VALUE: Record<CircusAnimal, number> = {
  elephant: 7,
  tiger: 6,
  bear: 5,
  seal: 4,
  monkey: 3,
  flea: 1,
}

export const ANIMAL_EMOJI: Record<CircusAnimal, string> = {
  elephant: '🐘',
  tiger: '🐅',
  bear: '🐻',
  seal: '🦭',
  monkey: '🐒',
  flea: '🦟',
}

/** Points each acrobat scores its owner. */
export const ACROBAT_POINTS = 5

/** Ringmaster bonus per adjacent circus/acrobat tile. */
export const RINGMASTER_PER_TILE = 2

/** Circus / Big Top: each nearby meeple scores the revealed animal's value. */
export function scoreCircus(animal: CircusAnimal, meeples: number): number {
  return ANIMAL_VALUE[animal] * clamp(meeples)
}

/** Acrobat pyramid: each acrobat scores its owner 5 points. */
export function scoreAcrobats(count: number): number {
  return clamp(count) * ACROBAT_POINTS
}

/** Ringmaster: +2 per circus/acrobat tile on or adjacent to its tile. */
export function scoreRingmaster(tiles: number): number {
  return clamp(tiles) * RINGMASTER_PER_TILE
}
