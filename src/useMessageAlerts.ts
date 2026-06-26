import { useCallback, useEffect, useRef, useState } from 'react'
import type { GameState, ScoreEntry } from './types'
import { MANUAL_MERGE_WINDOW } from './game/reducer'
import { messageQualifies } from './messageTrigger'
import { playMessageChime } from './sound'

const SOUND_KEY = 'carcassonne-companion:sound'

/**
 * Manual points are entered one ±1 tap at a time and the reducer coalesces a
 * rapid burst into a single log entry (its `amount` is the running net). We
 * only judge a manual entry once that burst has settled — a hair past the merge
 * window, so no further taps can fold in — otherwise nudging a score up to e.g.
 * 7 would graze 5 mid-burst and fire a spurious message.
 */
const MANUAL_SETTLE = MANUAL_MERGE_WINDOW + 300

function loadSoundPref(): boolean {
  try {
    return localStorage.getItem(SOUND_KEY) !== 'off'
  } catch {
    return true
  }
}

export interface MessageAlerts {
  /** Player ids currently showing a 📜 badge. */
  pending: Set<string>
  /** Bumped on each qualifying score; drives the attention toast. */
  toast: { id: number } | null
  /** Clear ALL badges — a message was resolved (only the active player draws). */
  clear: () => void
  /** Remove ONE player's badge — they crossed a ÷5 on someone else's turn. */
  dismiss: (id: string) => void
  soundOn: boolean
  setSoundOn: (on: boolean) => void
}

/**
 * The Messengers: a player earns a message when one of their two scoring
 * figures lands on a multiple of 5. With the optimal "÷5 → messenger, rest →
 * meeple" routing this collapses to {@link messageQualifies} — a single check
 * against the points scored and the player's running total.
 *
 * Discrete scores (features, goods, gold, message tiles) are judged the moment
 * they're logged. Manual points are judged on their *settled net* — the
 * coalesced entry's final `amount` once {@link MANUAL_SETTLE} passes — so
 * incremental ±1 nudges that graze a multiple of 5 don't misfire.
 *
 * Ephemeral UI state — not part of GameState/localStorage. De-dupes by entry id
 * so multiplayer's optimistic→reconciled echo can't double-fire, and ignores
 * initial load / room-resync so it never alerts for history.
 */
export function useMessageAlerts(state: GameState): MessageAlerts {
  const [pending, setPending] = useState<Set<string>>(() => new Set())
  const [toast, setToast] = useState<{ id: number } | null>(null)
  const [soundOn, setSoundOnState] = useState<boolean>(loadSoundPref)

  const seen = useRef<Set<string>>(new Set())
  const prevLen = useRef(0)
  const init = useRef(false)
  const toastSeq = useRef(0)
  const soundRef = useRef(soundOn)
  soundRef.current = soundOn

  // Latest log + players, read inside debounce timers for up-to-date values.
  const logRef = useRef<ScoreEntry[]>(state.log)
  logRef.current = state.log
  const playersRef = useRef(state.players)
  playersRef.current = state.players

  // Per manual-entry: last-seen net amount + its pending settle timer.
  const manualAmt = useRef<Map<string, number>>(new Map())
  const manualTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(
    new Map(),
  )

  const enabled = state.expansions.messages

  const fire = useCallback((playerId: string) => {
    setPending((prev) => {
      const next = new Set(prev)
      next.add(playerId)
      return next
    })
    toastSeq.current += 1
    setToast({ id: toastSeq.current })
    if (soundRef.current) playMessageChime()
  }, [])

  useEffect(() => {
    const log = state.log

    // First run: remember existing entries, never alert for history.
    if (!init.current) {
      init.current = true
      seen.current = new Set(log.map((e) => e.id))
      log.forEach((e) => {
        if (e.desc.kind === 'manual') manualAmt.current.set(e.id, e.amount)
      })
      prevLen.current = log.length
      return
    }

    const top = log[0]
    const grew = log.length === prevLen.current + 1
    prevLen.current = log.length

    if (enabled) {
      // Discrete scores: judge immediately when a single new entry appears.
      if (
        top &&
        grew &&
        !seen.current.has(top.id) &&
        top.desc.kind !== 'manual'
      ) {
        const player = state.players.find((p) => p.id === top.playerId)
        if (player && messageQualifies(top.amount, player.score)) fire(player.id)
      }

      // Manual entries: (re)arm a settle timer whenever a coalesced entry's net
      // changes; judge it once the burst is quiet.
      for (const e of log) {
        if (e.desc.kind !== 'manual') continue
        if (manualAmt.current.get(e.id) === e.amount) continue
        manualAmt.current.set(e.id, e.amount)
        const existing = manualTimers.current.get(e.id)
        if (existing) clearTimeout(existing)
        const id = e.id
        manualTimers.current.set(
          id,
          setTimeout(() => {
            manualTimers.current.delete(id)
            const entry = logRef.current.find((x) => x.id === id)
            if (!entry || entry.desc.kind !== 'manual') return
            const score = playersRef.current.find(
              (p) => p.id === entry.playerId,
            )?.score
            if (score != null && messageQualifies(entry.amount, score)) {
              fire(entry.playerId)
            }
          }, MANUAL_SETTLE),
        )
      }
    }

    // Drop tracking for entries that vanished (undo, or a burst netting to 0).
    const live = new Set(log.map((e) => e.id))
    manualTimers.current.forEach((timer, id) => {
      if (!live.has(id)) {
        clearTimeout(timer)
        manualTimers.current.delete(id)
      }
    })
    manualAmt.current.forEach((_amt, id) => {
      if (!live.has(id)) manualAmt.current.delete(id)
    })

    seen.current = live
  }, [state.log, state.players, enabled, fire])

  // Auto-dismiss the toast a few seconds after the latest trigger.
  useEffect(() => {
    if (!toast) return
    const timer = setTimeout(() => setToast(null), 4000)
    return () => clearTimeout(timer)
  }, [toast])

  // Cancel any pending manual timers on unmount.
  useEffect(() => {
    const timers = manualTimers.current
    return () => {
      timers.forEach((t) => clearTimeout(t))
      timers.clear()
    }
  }, [])

  const clear = useCallback(() => {
    // A reset / new game / resolved message also abandons any in-flight burst.
    // Keep `manualAmt` though: it records already-seen nets, so a still-logged
    // settled entry isn't mistaken for new and re-armed. Pruning drops vanished
    // ids after a reset.
    manualTimers.current.forEach((t) => clearTimeout(t))
    manualTimers.current.clear()
    setPending((prev) => (prev.size ? new Set() : prev))
  }, [])

  const dismiss = useCallback(
    (id: string) =>
      setPending((prev) => {
        if (!prev.has(id)) return prev
        const next = new Set(prev)
        next.delete(id)
        return next
      }),
    [],
  )

  const setSoundOn = useCallback((on: boolean) => {
    setSoundOnState(on)
    try {
      localStorage.setItem(SOUND_KEY, on ? 'on' : 'off')
    } catch {
      // ignore
    }
  }, [])

  return { pending, toast, clear, dismiss, soundOn, setSoundOn }
}
