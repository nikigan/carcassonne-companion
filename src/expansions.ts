/**
 * Registry of implemented Carcassonne expansions and the per-game on/off config.
 * Single source of truth: the picker UI, the defaults, and the gating logic all
 * derive from `EXPANSIONS`. Adding a future expansion is one entry here (plus its
 * gating in the components and its i18n strings). The base game is always in play
 * and intentionally absent from this list.
 */

export type ExpansionId =
  | 'innsCathedrals'
  | 'tradersBuilders'
  | 'bridgesCastlesBazaars'
  | 'goldMines'
  | 'messages'
  | 'mageWitch'
  | 'circus'

export interface ExpansionMeta {
  id: ExpansionId
  /** A representative emoji shown next to the expansion in the picker. */
  emoji: string
}

/** Ordered list driving the expansion picker. */
export const EXPANSIONS: ExpansionMeta[] = [
  { id: 'innsCathedrals', emoji: '🍺' },
  { id: 'tradersBuilders', emoji: '🐷' },
  { id: 'bridgesCastlesBazaars', emoji: '🏯' },
  { id: 'goldMines', emoji: '🟨' },
  { id: 'messages', emoji: '📜' },
  { id: 'mageWitch', emoji: '🧙' },
  { id: 'circus', emoji: '🎪' },
]

/** Which expansions are active in the current game. */
export type ExpansionConfig = Record<ExpansionId, boolean>

const buildConfig = (value: boolean): ExpansionConfig =>
  EXPANSIONS.reduce((acc, e) => {
    acc[e.id] = value
    return acc
  }, {} as ExpansionConfig)

/** Every expansion enabled (used when migrating older saves). */
export const ALL_ON: ExpansionConfig = buildConfig(true)

/** Base game only (the default for a brand-new first game). */
export const BASE_ONLY: ExpansionConfig = buildConfig(false)

/**
 * Normalize a possibly-partial stored config to a complete one, defaulting any
 * missing keys to `fallback` so a new expansion key added later doesn't read as
 * `undefined` on an older save.
 */
export function normalizeConfig(
  partial: Partial<ExpansionConfig> | undefined,
  fallback: ExpansionConfig,
): ExpansionConfig {
  if (!partial) return { ...fallback }
  return EXPANSIONS.reduce((acc, e) => {
    acc[e.id] = partial[e.id] ?? fallback[e.id]
    return acc
  }, {} as ExpansionConfig)
}
