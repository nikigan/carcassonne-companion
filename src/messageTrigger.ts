import type { ScoreDescriptor } from './types'

/**
 * The Messengers trigger (see useMessageAlerts). A player earns a message when
 * one of their two scoring figures lands on a multiple of 5. With the optimal
 * "÷5 → messenger, rest → meeple" routing this is a single check: the points
 * scored are a multiple of 5 (a messenger move), or the new running total is
 * (the meeple landing). Only forward (positive) moves can land on a space.
 *
 * For manual points — entered one ±1 tap at a time — `amount` is the *net*
 * change of a settled burst, so an intermediate tap that grazes a multiple of 5
 * never fires; only the burst's net result is judged.
 */
export function messageQualifies(amount: number, total: number): boolean {
  return amount > 0 && (amount % 5 === 0 || total % 5 === 0)
}

/**
 * Fields, trade goods and gold are all scored at game *end* — fields only count
 * when the game is over, and goods/gold are tallied in one batch via the menu —
 * so they never move a figure during play and must not draw a message. Every
 * other score is an in-play feature/manual move that can.
 */
const END_GAME_KINDS = new Set<ScoreDescriptor['kind']>([
  'field',
  'gold',
  'goodsBonus',
])

/** Whether a score of this kind can draw a message (i.e. is an in-play move). */
export function kindCanTriggerMessage(kind: ScoreDescriptor['kind']): boolean {
  return !END_GAME_KINDS.has(kind)
}
