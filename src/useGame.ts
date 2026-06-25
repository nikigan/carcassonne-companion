import { useCallback, useEffect, useRef, useState } from 'react'
import type { GameState, Player, ScoreEntry } from './types'
import { clearGame, emptyGame, loadGame, saveGame, uid } from './storage'

/**
 * Central game state hook. Owns players + score log, persists to localStorage
 * on every change, and exposes intent-named actions.
 */
export function useGame() {
  const [state, setState] = useState<GameState>(() => loadGame())

  // Persist after first render is skipped via this ref so we don't immediately
  // re-write what we just loaded (harmless, but avoids a redundant write).
  const hydrated = useRef(false)
  useEffect(() => {
    if (!hydrated.current) {
      hydrated.current = true
      return
    }
    saveGame(state)
  }, [state])

  const addPlayer = useCallback((name: string, color: string) => {
    setState((s) => ({
      ...s,
      players: [
        ...s.players,
        { id: uid(), name: name.trim() || `Player ${s.players.length + 1}`, color, score: 0 },
      ],
    }))
  }, [])

  const updatePlayer = useCallback(
    (id: string, patch: Partial<Pick<Player, 'name' | 'color'>>) => {
      setState((s) => ({
        ...s,
        players: s.players.map((p) => (p.id === id ? { ...p, ...patch } : p)),
      }))
    },
    [],
  )

  const removePlayer = useCallback((id: string) => {
    setState((s) => ({
      ...s,
      players: s.players.filter((p) => p.id !== id),
      log: s.log.filter((e) => e.playerId !== id),
    }))
  }, [])

  const startGame = useCallback(() => {
    setState((s) => (s.players.length > 0 ? { ...s, started: true } : s))
  }, [])

  /** Return to the player setup screen without losing scores. */
  const editPlayers = useCallback(() => {
    setState((s) => ({ ...s, started: false }))
  }, [])

  const addScore = useCallback((playerId: string, amount: number, label: string) => {
    if (!Number.isFinite(amount) || amount === 0) return
    const entry: ScoreEntry = {
      id: uid(),
      playerId,
      amount,
      label,
      timestamp: Date.now(),
    }
    setState((s) => ({
      ...s,
      players: s.players.map((p) =>
        p.id === playerId ? { ...p, score: p.score + amount } : p,
      ),
      log: [entry, ...s.log],
    }))
  }, [])

  /** Undo a single log entry, reverting its effect on the player's score. */
  const undoEntry = useCallback((entryId: string) => {
    setState((s) => {
      const entry = s.log.find((e) => e.id === entryId)
      if (!entry) return s
      return {
        ...s,
        players: s.players.map((p) =>
          p.id === entry.playerId ? { ...p, score: p.score - entry.amount } : p,
        ),
        log: s.log.filter((e) => e.id !== entryId),
      }
    })
  }, [])

  /** Reset scores to zero but keep the same players. */
  const resetScores = useCallback(() => {
    setState((s) => ({
      ...s,
      players: s.players.map((p) => ({ ...p, score: 0 })),
      log: [],
    }))
  }, [])

  /** Wipe everything and return to player setup. */
  const newGame = useCallback(() => {
    clearGame()
    setState({ ...emptyGame })
  }, [])

  return {
    state,
    addPlayer,
    updatePlayer,
    removePlayer,
    startGame,
    editPlayers,
    addScore,
    undoEntry,
    resetScores,
    newGame,
  }
}
