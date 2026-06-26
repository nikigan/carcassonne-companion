import type { GameState } from '../types'
import { applyAction, type GameAction } from './reducer'
import type { RoomActionMsg, RoomSnapshot } from './protocol'

export interface PendingAction { actionId: string; action: GameAction }

export interface RoomSyncState {
  confirmed: GameState
  confirmedSeq: number
  pending: PendingAction[]
}

export function initialSync(state: GameState, seq: number, _recent?: string[]): RoomSyncState {
  return { confirmed: state, confirmedSeq: seq, pending: [] }
}

/** What the UI renders: pending actions replayed over the confirmed base. */
export function displayedState(s: RoomSyncState): GameState {
  return s.pending.reduce((st, p) => applyAction(st, p.action), s.confirmed)
}

export function applyLocal(s: RoomSyncState, actionId: string, action: GameAction): RoomSyncState {
  return { ...s, pending: [...s.pending, { actionId, action }] }
}

/**
 * Apply an authoritative action from the server. Must arrive in seq order
 * (confirmedSeq + 1); a gap means we missed messages → caller should resync.
 */
export function applyServerAction(
  s: RoomSyncState, msg: RoomActionMsg,
): { state: RoomSyncState; needSnapshot: boolean } {
  if (msg.seq !== s.confirmedSeq + 1) return { state: s, needSnapshot: true }
  return {
    state: {
      confirmed: applyAction(s.confirmed, msg.action),
      confirmedSeq: msg.seq,
      pending: s.pending.filter((p) => p.actionId !== msg.actionId),
    },
    needSnapshot: false,
  }
}

/** Adopt a fresh snapshot; drop pending the server already has. */
export function applySnapshot(s: RoomSyncState, msg: RoomSnapshot): RoomSyncState {
  const acked = new Set(msg.recentActionIds)
  return {
    confirmed: msg.state,
    confirmedSeq: msg.seq,
    pending: s.pending.filter((p) => !acked.has(p.actionId)),
  }
}
