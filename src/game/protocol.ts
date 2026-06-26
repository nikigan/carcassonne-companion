import type { GameState } from '../types'
import type { GameAction } from './reducer'

export interface RoomSnapshot { type: 'snapshot'; state: GameState; seq: number; recentActionIds: string[] }
export interface RoomActionMsg { type: 'action'; actionId: string; action: GameAction; seq: number }
export interface RoomErrorMsg { type: 'error'; message: string }
export type ServerMessage = RoomSnapshot | RoomActionMsg | RoomErrorMsg
export type ClientMessage = { type: 'action'; actionId: string; action: GameAction }

/** Unambiguous alphabet — no 0/O/1/I/L. */
export const ROOM_CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
export const ROOM_CODE_LENGTH = 6

/** Generate a code. `rand` injectable for tests; defaults to Math.random. */
export function generateRoomCode(rand: () => number = Math.random): string {
  let out = ''
  for (let i = 0; i < ROOM_CODE_LENGTH; i++) {
    out += ROOM_CODE_ALPHABET[Math.floor(rand() * ROOM_CODE_ALPHABET.length)]
  }
  return out
}

export function roomPath(code: string): string {
  return `/r/${code.toUpperCase()}`
}

/** Extract a room code from a path like `/r/ABC123`, else null. */
export function roomCodeFromPath(path: string): string | null {
  const m = path.match(/^\/r\/([A-Za-z0-9]+)\/?$/)
  return m ? m[1].toUpperCase() : null
}
