import { describe, expect, it } from 'vitest'
import {
  generateRoomCode,
  roomCodeFromPath,
  ROOM_CODE_ALPHABET,
  ROOM_CODE_LENGTH,
} from './protocol'

describe('generateRoomCode', () => {
  it('produces a code with the correct length and only alphabet chars', () => {
    // Deterministic rand cycling through positions
    let i = 0
    const rand = () => (i++ % ROOM_CODE_ALPHABET.length) / ROOM_CODE_ALPHABET.length
    const code = generateRoomCode(rand)
    expect(code).toHaveLength(ROOM_CODE_LENGTH)
    for (const ch of code) {
      expect(ROOM_CODE_ALPHABET).toContain(ch)
    }
  })

  it('uses Math.random by default and still satisfies constraints', () => {
    const code = generateRoomCode()
    expect(code).toHaveLength(ROOM_CODE_LENGTH)
    for (const ch of code) {
      expect(ROOM_CODE_ALPHABET).toContain(ch)
    }
  })
})

describe('roomCodeFromPath', () => {
  it('returns the uppercased code for a valid uppercase code', () => {
    // Build a valid code from the first 6 alphabet chars
    const valid = ROOM_CODE_ALPHABET.slice(0, ROOM_CODE_LENGTH)
    expect(roomCodeFromPath(`/r/${valid}`)).toBe(valid)
  })

  it('uppercases a valid lowercase code', () => {
    const valid = ROOM_CODE_ALPHABET.slice(0, ROOM_CODE_LENGTH).toLowerCase()
    expect(roomCodeFromPath(`/r/${valid}`)).toBe(valid.toUpperCase())
  })

  it('returns null for a code that is too short', () => {
    const short = ROOM_CODE_ALPHABET.slice(0, ROOM_CODE_LENGTH - 1)
    expect(roomCodeFromPath(`/r/${short}`)).toBeNull()
  })

  it('returns null for a code containing an ambiguous char not in the alphabet (O)', () => {
    // Replace one char with O (excluded from alphabet)
    const candidate = ROOM_CODE_ALPHABET.slice(0, ROOM_CODE_LENGTH - 1) + 'O'
    expect(roomCodeFromPath(`/r/${candidate}`)).toBeNull()
  })

  it('returns null for a code containing ambiguous char 0', () => {
    const candidate = ROOM_CODE_ALPHABET.slice(0, ROOM_CODE_LENGTH - 1) + '0'
    expect(roomCodeFromPath(`/r/${candidate}`)).toBeNull()
  })

  it('returns null for a code containing ambiguous char 1', () => {
    const candidate = ROOM_CODE_ALPHABET.slice(0, ROOM_CODE_LENGTH - 1) + '1'
    expect(roomCodeFromPath(`/r/${candidate}`)).toBeNull()
  })

  it('returns null for a code containing ambiguous char I', () => {
    const candidate = ROOM_CODE_ALPHABET.slice(0, ROOM_CODE_LENGTH - 1) + 'I'
    expect(roomCodeFromPath(`/r/${candidate}`)).toBeNull()
  })

  it('returns null for a code containing ambiguous char L', () => {
    const candidate = ROOM_CODE_ALPHABET.slice(0, ROOM_CODE_LENGTH - 1) + 'L'
    expect(roomCodeFromPath(`/r/${candidate}`)).toBeNull()
  })

  it('returns null for a non-/r/ path', () => {
    const valid = ROOM_CODE_ALPHABET.slice(0, ROOM_CODE_LENGTH)
    expect(roomCodeFromPath(`/game/${valid}`)).toBeNull()
    expect(roomCodeFromPath('/')).toBeNull()
    expect(roomCodeFromPath('')).toBeNull()
  })
})
