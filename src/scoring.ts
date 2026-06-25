/**
 * Carcassonne scoring math (base game). These compute point values only;
 * human-readable labels are produced by the i18n layer from a ScoreDescriptor
 * so they can be localized.
 */

export type FeatureType = 'road' | 'city' | 'cloister' | 'field'

/** Emoji shown for each game feature (and for manual adjustments). */
export const FEATURE_EMOJI: Record<FeatureType | 'manual', string> = {
  road: '🛣️',
  city: '🏰',
  cloister: '⛪',
  field: '🌾',
  manual: '✏️',
}

/** Road: 1 point per tile (scored the same whether complete or not). */
export function scoreRoad(tiles: number): number {
  return Math.max(0, Math.floor(tiles))
}

/**
 * City: when completed during play, 2 points per tile + 2 per pennant.
 * Incomplete cities scored at game end are worth 1 per tile + 1 per pennant.
 */
export function scoreCity(
  tiles: number,
  pennants: number,
  completed: boolean,
): number {
  const t = Math.max(0, Math.floor(tiles))
  const p = Math.max(0, Math.floor(pennants))
  const per = completed ? 2 : 1
  return per * t + per * p
}

/**
 * Cloister: 1 point for the cloister tile + 1 per surrounding tile.
 * A completed cloister (all 8 neighbors) is worth 9.
 */
export function scoreCloister(surrounding: number, completed: boolean): number {
  if (completed) return 9
  const s = Math.min(8, Math.max(0, Math.floor(surrounding)))
  return 1 + s
}

/** Field (game end): 3 points for each completed city the field borders. */
export function scoreField(cities: number): number {
  return Math.max(0, Math.floor(cities)) * 3
}
