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
