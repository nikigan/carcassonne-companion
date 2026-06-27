import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { GameState, ScoreEntry } from './types'
import { MANUAL_MERGE_WINDOW } from './game/reducer'
import { kindCanTriggerMessage, messageQualifies } from './messageTrigger'
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

/** The synced-state mutators the alert hook drives (from useGame). */
export interface MessageActions {
  /** Mark a player as having earned a 📜 — synced so everyone shows the badge. */
  earnMessage: (playerId: string) => void
  /** Remove ONE player's badge — they crossed a ÷5 on someone else's turn. */
  dismissMessage: (playerId: string) => void
  /** Clear ALL badges — a message was resolved (only the active player draws). */
  resolveMessages: () => void
}

export interface MessageAlerts {
  /** Player ids currently showing a 📜 badge (mirrors `state.pendingMessages`). */
  pending: Set<string>
  /** Bumped on each qualifying score; drives the attention toast. */
  toast: { id: number } | null
  /** Resolve the message moment — clears every badge for everyone. */
  clear: () => void
  /** Dismiss one player's badge for everyone. */
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
 * The *badge set* lives in synced GameState (`state.pendingMessages`) so it's
 * consistent across a room and a dismiss/resolve propagates to everyone. This
 * hook is the **detector + notifier**: it watches the score log, and on a
 * genuine in-play qualifying score it chimes/toasts locally AND calls
 * {@link MessageActions.earnMessage} to record the badge for the whole room
 * (idempotent — every connected client detects the same move).
 *
 * Discrete scores (features, goods, gold, message tiles) are judged the moment
 * they're logged. Manual points are judged on their *settled net*. De-dupes by
 * entry id so multiplayer's optimistic→reconciled echo can't double-fire, and
 * reseeds (without firing) on first load and on every `syncEpoch` bump — a room
 * snapshot / join / leave — so a resync never replays historical notifications.
 */
export function useMessageAlerts(
  state: GameState,
  syncEpoch: number,
  actions: MessageActions,
): MessageAlerts {
  const [toast, setToast] = useState<{ id: number } | null>(null)
  const [soundOn, setSoundOnState] = useState<boolean>(loadSoundPref)

  // Badges are a pure projection of synced state; memoize so the Set identity is
  // stable across renders that don't touch the pending list.
  const pending = useMemo(
    () => new Set(state.pendingMessages ?? []),
    [state.pendingMessages],
  )

  const seen = useRef<Set<string>>(new Set())
  const prevLen = useRef(0)
  const init = useRef(false)
  const epochRef = useRef(syncEpoch)
  const toastSeq = useRef(0)
  const soundRef = useRef(soundOn)
  soundRef.current = soundOn

  // Latest mutators, read inside callbacks/timers without re-binding them.
  const actionsRef = useRef(actions)
  actionsRef.current = actions

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

  // A genuine in-play message: record the badge for the room (idempotent) and
  // notify locally. Every connected client runs this for the same move.
  const fire = useCallback((playerId: string) => {
    actionsRef.current.earnMessage(playerId)
    toastSeq.current += 1
    setToast({ id: toastSeq.current })
    if (soundRef.current) playMessageChime()
  }, [])

  useEffect(() => {
    const log = state.log

    // First run, or a wholesale base replacement (room snapshot / join / leave,
    // signalled by a `syncEpoch` bump): adopt the current log as already-seen
    // history and never alert for it. This is the fix for a new joiner getting
    // a burst of notifications for messages earned before they connected.
    if (!init.current || epochRef.current !== syncEpoch) {
      init.current = true
      epochRef.current = syncEpoch
      seen.current = new Set(log.map((e) => e.id))
      manualAmt.current = new Map()
      log.forEach((e) => {
        if (e.desc.kind === 'manual') manualAmt.current.set(e.id, e.amount)
      })
      // Cancel any settle timers armed against the previous base.
      manualTimers.current.forEach((t) => clearTimeout(t))
      manualTimers.current.clear()
      prevLen.current = log.length
      return
    }

    const top = log[0]
    const grew = log.length === prevLen.current + 1
    prevLen.current = log.length

    if (enabled) {
      // Discrete in-play scores: judge immediately when a single new entry
      // appears. Manual is debounced below; end-game tallies (gold, trade
      // goods) never draw a message.
      if (
        top &&
        grew &&
        !seen.current.has(top.id) &&
        top.desc.kind !== 'manual' &&
        kindCanTriggerMessage(top.desc.kind)
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
  }, [state.log, state.players, enabled, fire, syncEpoch])

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
    // A player drew the message tile: resolve it for everyone, and abandon any
    // in-flight manual burst locally. (reset / new game clear the synced set via
    // the reducer, so they don't route through here.)
    manualTimers.current.forEach((t) => clearTimeout(t))
    manualTimers.current.clear()
    actionsRef.current.resolveMessages()
  }, [])

  const dismiss = useCallback(
    (id: string) => actionsRef.current.dismissMessage(id),
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
