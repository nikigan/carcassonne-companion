import { describe, expect, it } from 'vitest'
import { applyAction, emptyGame, type GameAction } from './reducer'
import type { GameState } from '../types'
import { emptyGoods } from '../types'
import { ALL_ON } from '../expansions'

function gameWith(players: Array<{ id: string; score?: number }>): GameState {
  return {
    ...emptyGame,
    started: true,
    expansions: ALL_ON,
    players: players.map((p) => ({
      id: p.id, name: p.id, color: '#fff', score: p.score ?? 0,
      goods: emptyGoods(), gold: 0,
    })),
  }
}

describe('applyAction', () => {
  it('addScore adds points and prepends a log entry', () => {
    const s0 = gameWith([{ id: 'a' }])
    const act: GameAction = {
      type: 'addScore', id: 'e1', playerId: 'a', amount: 5,
      desc: { kind: 'castle', value: 5 }, timestamp: 1000,
    }
    const s1 = applyAction(s0, act)
    expect(s1.players[0].score).toBe(5)
    expect(s1.log[0]).toMatchObject({ id: 'e1', playerId: 'a', amount: 5 })
    expect(s0.players[0].score).toBe(0) // input not mutated
  })

  it('is deterministic: same base + action twice are equal', () => {
    const s0 = gameWith([{ id: 'a' }])
    const act: GameAction = {
      type: 'addScore', id: 'e1', playerId: 'a', amount: 5,
      desc: { kind: 'castle', value: 5 }, timestamp: 1000,
    }
    expect(applyAction(s0, act)).toEqual(applyAction(s0, act))
  })

  it('coalesces manual changes inside the merge window', () => {
    const s0 = gameWith([{ id: 'a' }])
    const a1: GameAction = { type: 'addScore', id: 'm1', playerId: 'a', amount: 2, desc: { kind: 'manual', amount: 2 }, timestamp: 1000 }
    const a2: GameAction = { type: 'addScore', id: 'm2', playerId: 'a', amount: 3, desc: { kind: 'manual', amount: 3 }, timestamp: 2000 }
    const s2 = applyAction(applyAction(s0, a1), a2)
    expect(s2.players[0].score).toBe(5)
    expect(s2.log).toHaveLength(1)
    expect(s2.log[0]).toMatchObject({ id: 'm1', amount: 5 })
  })

  it('starts a fresh manual entry after the window lapses', () => {
    const s0 = gameWith([{ id: 'a' }])
    const a1: GameAction = { type: 'addScore', id: 'm1', playerId: 'a', amount: 2, desc: { kind: 'manual', amount: 2 }, timestamp: 1000 }
    const a2: GameAction = { type: 'addScore', id: 'm2', playerId: 'a', amount: 3, desc: { kind: 'manual', amount: 3 }, timestamp: 9000 }
    const s2 = applyAction(applyAction(s0, a1), a2)
    expect(s2.log).toHaveLength(2)
  })

  it('undoEntry reverts the score and removes the entry', () => {
    const s0 = gameWith([{ id: 'a' }])
    const s1 = applyAction(s0, { type: 'addScore', id: 'e1', playerId: 'a', amount: 5, desc: { kind: 'castle', value: 5 }, timestamp: 1 })
    const s2 = applyAction(s1, { type: 'undoEntry', entryId: 'e1' })
    expect(s2.players[0].score).toBe(0)
    expect(s2.log).toHaveLength(0)
  })

  it('scoreTradeGoods awards majorities with deterministic entry ids; ties shared', () => {
    const s0: GameState = { ...gameWith([{ id: 'a' }, { id: 'b' }]) }
    s0.players[0].goods = { wine: 3, grain: 1, cloth: 0 }
    s0.players[1].goods = { wine: 3, grain: 2, cloth: 0 }
    const s1 = applyAction(s0, { type: 'scoreTradeGoods', id: 'tg', timestamp: 5 })
    // wine tie (a,b +10 each), grain b (+10)
    expect(s1.players[0].score).toBe(10)
    expect(s1.players[1].score).toBe(20)
    expect(s1.players[0].goods).toEqual(emptyGoods())
    expect(s1.log.every((e) => e.id.startsWith('tg-'))).toBe(true)
  })

  it('scoreGoldIngots scores progressively then clears gold', () => {
    const s0 = gameWith([{ id: 'a' }])
    s0.players[0].gold = 5 // 5 * rate(2) = 10
    const s1 = applyAction(s0, { type: 'scoreGoldIngots', id: 'g', timestamp: 5 })
    expect(s1.players[0].score).toBe(10)
    expect(s1.players[0].gold).toBe(0)
  })

  it('removePlayer prunes that player\'s log entries', () => {
    const s0 = gameWith([{ id: 'a' }, { id: 'b' }])
    const s1 = applyAction(s0, { type: 'addScore', id: 'e1', playerId: 'a', amount: 5, desc: { kind: 'castle', value: 5 }, timestamp: 1 })
    const s2 = applyAction(s1, { type: 'removePlayer', id: 'a' })
    expect(s2.players).toHaveLength(1)
    expect(s2.log).toHaveLength(0)
  })

  it('newGame resets but keeps the expansion selection', () => {
    const s0 = gameWith([{ id: 'a' }])
    const s1 = applyAction(s0, { type: 'newGame' })
    expect(s1.players).toHaveLength(0)
    expect(s1.started).toBe(false)
    expect(s1.expansions).toEqual(ALL_ON)
    expect(s1.pendingMessages).toEqual([])
  })

  describe('pendingMessages (The Messengers)', () => {
    it('earnMessage adds a player id and is idempotent', () => {
      const s0 = gameWith([{ id: 'a' }, { id: 'b' }])
      const s1 = applyAction(s0, { type: 'earnMessage', playerId: 'a' })
      expect(s1.pendingMessages).toEqual(['a'])
      // Re-earning the same player is a no-op (returns the same reference).
      const s2 = applyAction(s1, { type: 'earnMessage', playerId: 'a' })
      expect(s2).toBe(s1)
      const s3 = applyAction(s2, { type: 'earnMessage', playerId: 'b' })
      expect(s3.pendingMessages).toEqual(['a', 'b'])
    })

    it('dismissMessage removes one badge, resolveMessages clears all', () => {
      let s = gameWith([{ id: 'a' }, { id: 'b' }])
      s = applyAction(s, { type: 'earnMessage', playerId: 'a' })
      s = applyAction(s, { type: 'earnMessage', playerId: 'b' })
      const dismissed = applyAction(s, { type: 'dismissMessage', playerId: 'a' })
      expect(dismissed.pendingMessages).toEqual(['b'])
      const resolved = applyAction(s, { type: 'resolveMessages' })
      expect(resolved.pendingMessages).toEqual([])
    })

    it('tolerates a legacy state with no pendingMessages field', () => {
      const legacy = gameWith([{ id: 'a' }]) as GameState
      delete (legacy as { pendingMessages?: string[] }).pendingMessages
      const s1 = applyAction(legacy, { type: 'earnMessage', playerId: 'a' })
      expect(s1.pendingMessages).toEqual(['a'])
    })

    it('resetScores clears pending badges', () => {
      let s = gameWith([{ id: 'a' }])
      s = applyAction(s, { type: 'earnMessage', playerId: 'a' })
      const reset = applyAction(s, { type: 'resetScores' })
      expect(reset.pendingMessages).toEqual([])
    })

    it('removePlayer drops that player\'s badge', () => {
      let s = gameWith([{ id: 'a' }, { id: 'b' }])
      s = applyAction(s, { type: 'earnMessage', playerId: 'a' })
      s = applyAction(s, { type: 'earnMessage', playerId: 'b' })
      const s1 = applyAction(s, { type: 'removePlayer', id: 'a' })
      expect(s1.pendingMessages).toEqual(['b'])
    })

    it('turning The Messages off clears pending badges', () => {
      let s = gameWith([{ id: 'a' }])
      s = applyAction(s, { type: 'earnMessage', playerId: 'a' })
      const off = applyAction(s, { type: 'setExpansion', expansion: 'messages', on: false })
      expect(off.pendingMessages).toEqual([])
    })
  })
})
