import { useCallback, useEffect, useRef, useState } from 'react'
import type { GameState, Player, ScoreDescriptor, TokenDelta } from './types'
import type { ExpansionId } from './expansions'
import { applyAction, type GameAction } from './game/reducer'
import {
  initialSync, applyLocal, applyServerAction, applySnapshot, displayedState,
  type RoomSyncState,
} from './game/roomSync'
import { RoomConnection, type RoomStatus } from './game/roomConnection'
import { generateRoomCode, roomCodeFromPath, roomPath } from './game/protocol'
import {
  loadGame, saveGame, uid,
  loadActiveRoom, saveActiveRoom, loadRoomCache, saveRoomCache, clearRoomCache,
} from './storage'

export interface RoomInfo { code: string; status: RoomStatus }

export function useGame() {
  const [state, setState] = useState<GameState>(() => loadGame())

  // Room mode. `room` is null for solo play and non-null once we create or join
  // a room. The optimistic sync machine and the live socket live in refs (not
  // state) so the socket callbacks — which fire outside React's render — always
  // read the current values without re-binding.
  const [room, setRoom] = useState<RoomInfo | null>(null)
  const syncRef = useRef<RoomSyncState | null>(null)
  const connRef = useRef<RoomConnection | null>(null)

  // Skip persisting on the very first render: `state` was just hydrated from
  // storage, so writing it straight back is redundant. After that, branch on
  // mode — room games persist to a per-room cache, solo games to the solo key —
  // so the two survive a reload independently and never clobber each other.
  const hydrated = useRef(false)
  useEffect(() => {
    if (!hydrated.current) { hydrated.current = true; return }
    if (room) saveRoomCache(room.code, state)
    else saveGame(state)
  }, [state, room])

  // Mirror the room's displayed state (confirmed base + replayed pending) into
  // React so the UI re-renders after every sync transition.
  const pushDisplayed = useCallback(() => {
    if (syncRef.current) setState(displayedState(syncRef.current))
  }, [])

  // Open a live socket for `code` and feed its messages into the sync machine.
  // The handlers close over `conn`; they fire asynchronously (after the socket
  // connects), by which point `conn` is assigned, so resending pending is safe.
  const openConnection = useCallback((code: string) => {
    const conn = new RoomConnection(code, {
      onSnapshot: (msg) => {
        syncRef.current = syncRef.current
          ? applySnapshot(syncRef.current, msg)
          : initialSync(msg.state, msg.seq, msg.recentActionIds)
        // Resend still-pending optimistic actions; the server dedupes by id.
        for (const p of syncRef.current.pending) {
          conn.send({ type: 'action', actionId: p.actionId, action: p.action })
        }
        pushDisplayed()
      },
      onAction: (msg) => {
        if (!syncRef.current) return
        const r = applyServerAction(syncRef.current, msg)
        syncRef.current = r.state
        pushDisplayed()
        // On a seq gap the server re-snapshots on our next reconnect, so the
        // missed action is reconciled then; nothing else to do here.
      },
      onStatus: (status) => setRoom((r) => (r ? { ...r, status } : r)),
    })
    connRef.current = conn
  }, [pushDisplayed])

  // Single dispatch seam. In a room, apply the action optimistically through the
  // sync machine, paint it immediately, and send it over the socket — the server
  // echo reconciles it later. Solo, reduce locally exactly as before.
  const dispatch = useCallback((action: GameAction) => {
    if (room && syncRef.current && connRef.current) {
      const actionId = uid()
      syncRef.current = applyLocal(syncRef.current, actionId, action)
      setState(displayedState(syncRef.current))
      connRef.current.send({ type: 'action', actionId, action })
    } else {
      setState((s) => applyAction(s, action))
    }
  }, [room])

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

  // --- Room lifecycle -------------------------------------------------------

  const createRoom = useCallback(async () => {
    // Seed the new room from the CURRENT solo game. Retry on a code collision
    // (server reports `seeded: false`); give up after a few attempts.
    for (let i = 0; i < 3; i++) {
      const code = generateRoomCode()
      const res = await fetch(`/api/room/${code}`, {
        method: 'POST', body: JSON.stringify({ state }),
      }).then((r) => r.json() as Promise<{ ok: boolean; seeded: boolean }>).catch(() => null)
      if (res?.seeded) {
        syncRef.current = initialSync(state, 0)
        saveActiveRoom(code); saveRoomCache(code, state)
        history.pushState(null, '', roomPath(code))
        setRoom({ code, status: 'connecting' })
        openConnection(code)
        return code
      }
    }
    return null
  }, [state, openConnection])

  const joinRoom = useCallback((code: string) => {
    // Paint instantly from cache when we've seen this room before; the snapshot
    // that follows the socket open reconciles us to the server's truth.
    const cached = loadRoomCache(code)
    syncRef.current = cached ? initialSync(cached, 0) : null
    if (cached) setState(cached)
    saveActiveRoom(code)
    history.pushState(null, '', roomPath(code))
    setRoom({ code, status: 'connecting' })
    openConnection(code)
  }, [openConnection])

  const leaveRoom = useCallback(() => {
    connRef.current?.close()
    connRef.current = null
    syncRef.current = null
    const code = room?.code
    if (code) { saveActiveRoom(null); clearRoomCache(code) }
    setRoom(null)
    history.pushState(null, '', '/')
    setState(loadGame()) // restore the untouched solo game
  }, [room])

  // Auto-join from the URL (/r/<code>) or the remembered active room, once on
  // mount. The ref guards against StrictMode's double-invoke opening two sockets.
  const bootstrapped = useRef(false)
  useEffect(() => {
    if (bootstrapped.current) return
    bootstrapped.current = true
    const code = roomCodeFromPath(location.pathname) ?? loadActiveRoom()
    if (code) joinRoom(code)
  }, [joinRoom])

  return {
    state, room, createRoom, joinRoom, leaveRoom,
    addPlayer, updatePlayer, removePlayer, startGame, editPlayers,
    setExpansion, addScore, recordTokens, scoreTradeGoods, scoreGoldIngots,
    undoEntry, resetScores, newGame,
  }
}
