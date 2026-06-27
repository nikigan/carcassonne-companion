import { useCallback, useEffect, useRef, useState } from 'react'
import type { GameState, Player, ScoreDescriptor, TokenDelta } from './types'
import type { ExpansionId } from './expansions'
import { applyAction, type GameAction } from './game/reducer'
import { useRoom } from './useRoom'
import { loadGame, saveGame, saveRoomCache, uid } from './storage'

export type { RoomInfo } from './useRoom'

export function useGame() {
  const [state, setState] = useState<GameState>(() => loadGame())

  // Mirror the displayed state into a ref so useRoom's getState() always reads
  // the latest value at call time (for seeding a new room and for the join
  // placeholder base) without re-binding callbacks — no stale closures.
  const stateRef = useRef(state)
  stateRef.current = state

  // The multiplayer-room concern. It drives the displayed state through the
  // getState/setDisplayed pair below; `room.room` is null for solo play.
  const room = useRoom({ getState: () => stateRef.current, setDisplayed: setState })

  // Skip persisting on the very first render: `state` was just hydrated from
  // storage, so writing it straight back is redundant. After that, branch on
  // mode — room games persist to a per-room cache, solo games to the solo key —
  // so the two survive a reload independently and never clobber each other.
  const hydrated = useRef(false)
  useEffect(() => {
    if (!hydrated.current) { hydrated.current = true; return }
    if (room.room) saveRoomCache(room.room.code, state)
    else saveGame(state)
  }, [state, room.room])

  // Single dispatch seam. In a room, useRoom applies the action optimistically,
  // paints it, and sends it over the socket (returning true). Solo, reduce
  // locally exactly as before.
  const dispatch = useCallback((action: GameAction) => {
    if (!room.dispatchInRoom(action)) setState((s) => applyAction(s, action))
  }, [room.dispatchInRoom])

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

  // The Messengers (📜). `earnMessage` is dispatched by useMessageAlerts when a
  // client detects an in-play message; `resolveMessages`/`dismissMessage` back
  // the badge tap and the ✕. All sync through the room like any other action.
  const earnMessage = useCallback((playerId: string) =>
    dispatch({ type: 'earnMessage', playerId }), [dispatch])
  const dismissMessage = useCallback((playerId: string) =>
    dispatch({ type: 'dismissMessage', playerId }), [dispatch])
  const resolveMessages = useCallback(() =>
    dispatch({ type: 'resolveMessages' }), [dispatch])

  return {
    state,
    room: room.room,
    syncEpoch: room.syncEpoch,
    createRoom: room.createRoom,
    joinRoom: room.joinRoom,
    leaveRoom: room.leaveRoom,
    addPlayer, updatePlayer, removePlayer, startGame, editPlayers,
    setExpansion, addScore, recordTokens, scoreTradeGoods, scoreGoldIngots,
    undoEntry, resetScores, newGame,
    earnMessage, dismissMessage, resolveMessages,
  }
}
