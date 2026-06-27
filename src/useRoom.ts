import { useCallback, useEffect, useRef, useState } from 'react'
import type { GameState } from './types'
import type { GameAction } from './game/reducer'
import {
  initialSync, applyLocal, applyServerAction, applySnapshot, displayedState,
  type RoomSyncState,
} from './game/roomSync'
import { RoomConnection, type RoomStatus } from './game/roomConnection'
import { generateRoomCode, roomCodeFromPath, roomPath } from './game/protocol'
import {
  loadGame, uid,
  loadActiveRoom, saveActiveRoom, loadRoomCache, saveRoomCache, clearRoomCache,
  loadHostToken, saveHostToken,
} from './storage'

export interface RoomInfo { code: string; status: RoomStatus; isHost: boolean }

export interface UseRoom {
  room: RoomInfo | null
  createRoom: () => Promise<string | null>
  joinRoom: (code: string) => void
  leaveRoom: () => void
  /** In a room: optimistically apply + send the action, return true. Else return false. */
  dispatchInRoom: (action: GameAction) => boolean
  /**
   * Bumped on every wholesale displayed-state replacement (snapshot, join,
   * create, leave) — i.e. whenever the score log changes without being an
   * in-play move. Lets the message-alert detector reseed its "seen" set so a
   * resync never replays historical 📜 notifications.
   */
  syncEpoch: number
}

export interface UseRoomOptions {
  /** Current displayed game state, for seeding + the join placeholder base. */
  getState: () => GameState
  /** Push room-derived displayed state into the host hook. */
  setDisplayed: (gs: GameState) => void
}

/**
 * The multiplayer-room concern factored out of useGame: the live connection,
 * the optimistic sync machine, create/join/leave, the host token, and the
 * auto-join-on-mount effect. The host hook hands in a `getState`/`setDisplayed`
 * pair; this hook reads/writes the displayed game state through them.
 */
export function useRoom(opts: UseRoomOptions): UseRoom {
  // Keep the latest accessor pair in a ref so the socket callbacks and the room
  // actions always read current values without re-binding on every render — the
  // same trick the sync/connection refs use. This avoids stale closures and
  // keeps the action callbacks stable across ordinary renders.
  const optsRef = useRef(opts)
  optsRef.current = opts

  // Room mode. `room` is null for solo play and non-null once we create or join
  // a room. The optimistic sync machine and the live socket live in refs (not
  // state) so the socket callbacks — which fire outside React's render — always
  // read the current values without re-binding.
  const [room, setRoom] = useState<RoomInfo | null>(null)
  // Bumped whenever the displayed state is replaced wholesale (not an in-play
  // move): each snapshot, plus join/create/leave. See UseRoom.syncEpoch.
  const [syncEpoch, setSyncEpoch] = useState(0)
  const bumpSyncEpoch = useCallback(() => setSyncEpoch((n) => n + 1), [])
  const syncRef = useRef<RoomSyncState | null>(null)
  const connRef = useRef<RoomConnection | null>(null)
  // The host token for the current room (the creator's secret). Null when we're
  // not the host. Lives in a ref so socket callbacks always read the current value.
  const hostTokenRef = useRef<string | null>(null)

  // Mirror the room's displayed state (confirmed base + replayed pending) into
  // the host hook so the UI re-renders after every sync transition.
  const pushDisplayed = useCallback(() => {
    if (syncRef.current) optsRef.current.setDisplayed(displayedState(syncRef.current))
  }, [])

  // Open a live socket for `code` and feed its messages into the sync machine.
  // The handlers close over `conn`; they fire asynchronously (after the socket
  // connects), by which point `conn` is assigned, so resending pending is safe.
  const openConnection = useCallback((code: string) => {
    connRef.current?.close()
    const conn = new RoomConnection(code, {
      onSnapshot: (msg) => {
        syncRef.current = syncRef.current
          ? applySnapshot(syncRef.current, msg)
          : initialSync(msg.state, msg.seq, msg.recentActionIds)
        // Resend still-pending optimistic actions; the server dedupes by id.
        for (const p of syncRef.current.pending) {
          conn.send({ type: 'action', actionId: p.actionId, action: p.action, hostToken: hostTokenRef.current ?? undefined })
        }
        // A snapshot is a wholesale base replacement — reseed message alerts so
        // none of its history fires a notification.
        bumpSyncEpoch()
        pushDisplayed()
      },
      onAction: (msg) => {
        if (!syncRef.current) return
        const r = applyServerAction(syncRef.current, msg)
        syncRef.current = r.state
        // A seq gap means we missed an action. Force a reconnect so the server
        // sends a fresh snapshot and reconciles the gap immediately.
        if (r.needSnapshot) conn.forceReconnect()
        pushDisplayed()
      },
      onStatus: (status) => setRoom((r) => (r ? { ...r, status } : r)),
    })
    connRef.current = conn
  }, [pushDisplayed, bumpSyncEpoch])

  // In a room, apply the action optimistically through the sync machine, paint
  // it immediately, and send it over the socket — the server echo reconciles it
  // later; return true. Solo (no room/sync/conn), return false so the host hook
  // reduces locally instead.
  const dispatchInRoom = useCallback((action: GameAction): boolean => {
    if (room && syncRef.current && connRef.current) {
      const actionId = uid()
      syncRef.current = applyLocal(syncRef.current, actionId, action)
      optsRef.current.setDisplayed(displayedState(syncRef.current))
      connRef.current.send({ type: 'action', actionId, action, hostToken: hostTokenRef.current ?? undefined })
      return true
    }
    return false
  }, [room])

  const createRoom = useCallback(async () => {
    // Seed the new room from the CURRENT solo game. Retry on a code collision
    // (server reports `seeded: false`); give up after a few attempts.
    const state = optsRef.current.getState()
    for (let i = 0; i < 3; i++) {
      const code = generateRoomCode()
      // The creator mints a host token, persists it per-room, and seeds it to
      // the DO so only this device can later run the host-only actions.
      const hostToken = uid()
      const res = await fetch(`/api/room/${code}`, {
        method: 'POST', body: JSON.stringify({ state, hostToken }),
      }).then((r) => r.json() as Promise<{ ok: boolean; seeded: boolean }>).catch(() => null)
      if (res?.seeded) {
        saveHostToken(code, hostToken)
        hostTokenRef.current = hostToken
        syncRef.current = initialSync(state, 0)
        saveActiveRoom(code); saveRoomCache(code, state)
        history.pushState(null, '', roomPath(code))
        setRoom({ code, status: 'connecting', isHost: true })
        openConnection(code)
        return code
      }
    }
    return null
  }, [openConnection])

  const joinRoom = useCallback((code: string) => {
    // Always initialize sync so dispatch takes the room path immediately,
    // queueing any optimistic actions until the first snapshot arrives.
    // Use the cached state as the confirmed base when available; otherwise
    // use the current displayed state as a placeholder (the real snapshot
    // will replace it and replay any pending actions on top).
    const cached = loadRoomCache(code)
    // A returning creator still has the stored host token → host again; a fresh
    // joiner has none → not host.
    const token = loadHostToken(code)
    hostTokenRef.current = token
    syncRef.current = initialSync(cached ?? optsRef.current.getState(), 0)
    optsRef.current.setDisplayed(displayedState(syncRef.current))
    bumpSyncEpoch() // adopting a placeholder base is a wholesale replacement
    saveActiveRoom(code)
    history.pushState(null, '', roomPath(code))
    setRoom({ code, status: 'connecting', isHost: token !== null })
    openConnection(code)
  }, [openConnection, bumpSyncEpoch])

  const leaveRoom = useCallback(() => {
    connRef.current?.close()
    connRef.current = null
    syncRef.current = null
    // Forget the live token but keep the localStorage copy, so a future rejoin
    // restores host.
    hostTokenRef.current = null
    const code = room?.code
    if (code) { saveActiveRoom(null); clearRoomCache(code) }
    setRoom(null)
    history.pushState(null, '', '/')
    optsRef.current.setDisplayed(loadGame()) // restore the untouched solo game
    bumpSyncEpoch() // swapping back to the solo game is a wholesale replacement
  }, [room, bumpSyncEpoch])

  // Auto-join from the URL (/r/<code>) or the remembered active room, once on
  // mount. The ref guards against StrictMode's double-invoke opening two sockets.
  const bootstrapped = useRef(false)
  useEffect(() => {
    if (bootstrapped.current) return
    bootstrapped.current = true
    const code = roomCodeFromPath(location.pathname) ?? loadActiveRoom()
    if (code) joinRoom(code)
  }, [joinRoom])

  return { room, createRoom, joinRoom, leaveRoom, dispatchInRoom, syncEpoch }
}
