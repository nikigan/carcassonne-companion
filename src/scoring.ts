/**
 * Carcassonne scoring helpers.
 *
 * These mirror the base-game rules. Each returns the point value and a
 * human-readable label so the score log reads naturally.
 */

export type FeatureType = 'road' | 'city' | 'cloister' | 'field'

export interface PresetResult {
  amount: number
  label: string
}

export const FEATURE_LABELS: Record<FeatureType, string> = {
  road: 'Road',
  city: 'City',
  cloister: 'Cloister',
  field: 'Field',
}

/** Road: 1 point per tile (scored the same whether complete or not). */
export function scoreRoad(tiles: number): PresetResult {
  const t = Math.max(0, Math.floor(tiles))
  return { amount: t, label: `Road (${t} ${plural(t, 'tile')})` }
}

/**
 * City: when completed during play, 2 points per tile + 2 per pennant.
 * Incomplete cities scored at game end are worth 1 per tile + 1 per pennant.
 */
export function scoreCity(
  tiles: number,
  pennants: number,
  completed: boolean,
): PresetResult {
  const t = Math.max(0, Math.floor(tiles))
  const p = Math.max(0, Math.floor(pennants))
  const per = completed ? 2 : 1
  const amount = per * t + per * p
  const state = completed ? 'completed' : 'incomplete'
  const pennLabel = p > 0 ? `, ${p} ${plural(p, 'pennant')}` : ''
  return {
    amount,
    label: `City ${state} (${t} ${plural(t, 'tile')}${pennLabel})`,
  }
}

/**
 * Cloister: 1 point for the cloister tile + 1 per surrounding tile.
 * A completed cloister (all 8 neighbors) is worth 9.
 */
export function scoreCloister(
  surrounding: number,
  completed: boolean,
): PresetResult {
  if (completed) {
    return { amount: 9, label: 'Cloister completed (9)' }
  }
  const s = Math.min(8, Math.max(0, Math.floor(surrounding)))
  return {
    amount: 1 + s,
    label: `Cloister (${s} surrounding ${plural(s, 'tile')})`,
  }
}

/** Field (game end): 3 points for each completed city the field borders. */
export function scoreField(cities: number): PresetResult {
  const c = Math.max(0, Math.floor(cities))
  return { amount: c * 3, label: `Field (${c} completed ${plural(c, 'city', 'cities')})` }
}

function plural(n: number, singular: string, pluralForm?: string): string {
  if (n === 1) return singular
  return pluralForm ?? `${singular}s`
}
