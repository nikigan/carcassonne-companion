import { useCallback, useEffect, useRef, useState } from 'react'
import type { GameState } from './types'
import { playMessageChime } from './sound'

const SOUND_KEY = 'carcassonne-companion:sound'

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
 * meeple" routing this collapses to a single check per score:
 *   amount > 0 && (amount % 5 === 0 || newTotal % 5 === 0)
 * so we only need the latest entry and the player's running total.
 *
 * Ephemeral UI state — not part of GameState/localStorage. Fires only on a
 * single new log entry (so undo, initial load and room-resync never trigger),
 * and de-dupes by entry id (so multiplayer's optimistic→reconciled echo of the
 * same id can't double-fire).
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

  const enabled = state.expansions.messages

  useEffect(() => {
    const log = state.log
    const top = log[0]

    // First run: remember existing entries, never alert for history.
    if (!init.current) {
      init.current = true
      seen.current = new Set(log.map((e) => e.id))
      prevLen.current = log.length
      return
    }

    const grew = log.length === prevLen.current + 1
    prevLen.current = log.length

    if (enabled && top && grew && !seen.current.has(top.id)) {
      const player = state.players.find((p) => p.id === top.playerId)
      if (
        player &&
        top.amount > 0 &&
        (top.amount % 5 === 0 || player.score % 5 === 0)
      ) {
        setPending((prev) => {
          const next = new Set(prev)
          next.add(player.id)
          return next
        })
        toastSeq.current += 1
        setToast({ id: toastSeq.current })
        if (soundRef.current) playMessageChime()
      }
    }

    seen.current = new Set(log.map((e) => e.id))
  }, [state.log, state.players, enabled])

  // Auto-dismiss the toast a few seconds after the latest trigger.
  useEffect(() => {
    if (!toast) return
    const timer = setTimeout(() => setToast(null), 4000)
    return () => clearTimeout(timer)
  }, [toast])

  const clear = useCallback(
    () => setPending((prev) => (prev.size ? new Set() : prev)),
    [],
  )

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
