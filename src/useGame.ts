import { useCallback, useEffect, useRef, useState } from 'react'
import type { GameState, Player, ScoreDescriptor, TokenDelta } from './types'
import type { ExpansionId } from './expansions'
import { applyAction, type GameAction } from './game/reducer'
import { loadGame, saveGame, uid } from './storage'

export function useGame() {
  const [state, setState] = useState<GameState>(() => loadGame())

  const hydrated = useRef(false)
  useEffect(() => {
    if (!hydrated.current) { hydrated.current = true; return }
    saveGame(state)
  }, [state])

  // Single dispatch seam. Task 6 makes this room-aware; today it reduces locally.
  const dispatch = useCallback((action: GameAction) => {
    setState((s) => applyAction(s, action))
  }, [])

  const addPlayer = useCallback((name: string, color: string) =>
    dispatch({ type: 'addPlayer', id: uid(), name, color }), [dispatch])

  const updatePlayer = useCallback((id: string, patch: Partial<Pick<Player, 'name' | 'color'>>) =>
    dispatch({ type: 'updatePlayer', id, patch }), [dispatch])

  const removePlayer = useCallback((id: string) =>
    dispatch({ type: 'removePlayer', id }), [dispatch])

  const startGame = useCallback(() => dispatch({ type: 'startGame' }), [dispatch])
  const editPlayers = useCallback(() => dispatch({ type: 'editPlayers' }), [dispatch])
  const setExpansion = useCallback((id: ExpansionId, on: boolean) =>
    dispatch({ type: 'setExpansion', expansion: id, on }), [dispatch])

  const addScore = useCallback((playerId: string, amount: number, desc: ScoreDescriptor) => {
    if (!Number.isFinite(amount) || amount === 0) return
    dispatch({ type: 'addScore', id: uid(), playerId, amount, desc, timestamp: Date.now() })
  }, [dispatch])

  const recordTokens = useCallback((playerId: string, delta: TokenDelta) =>
    dispatch({ type: 'recordTokens', playerId, delta }), [dispatch])

  const scoreTradeGoods = useCallback(() =>
    dispatch({ type: 'scoreTradeGoods', id: uid(), timestamp: Date.now() }), [dispatch])

  const scoreGoldIngots = useCallback(() =>
    dispatch({ type: 'scoreGoldIngots', id: uid(), timestamp: Date.now() }), [dispatch])

  const undoEntry = useCallback((entryId: string) =>
    dispatch({ type: 'undoEntry', entryId }), [dispatch])

  const resetScores = useCallback(() => dispatch({ type: 'resetScores' }), [dispatch])
  const newGame = useCallback(() => dispatch({ type: 'newGame' }), [dispatch])

  return {
    state, addPlayer, updatePlayer, removePlayer, startGame, editPlayers,
    setExpansion, addScore, recordTokens, scoreTradeGoods, scoreGoldIngots,
    undoEntry, resetScores, newGame,
  }
}
