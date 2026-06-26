import { describe, expect, it } from 'vitest'
import { applyLocal, applyServerAction, applySnapshot, displayedState, initialSync } from './roomSync'
import { emptyGame, type GameAction } from './reducer'
import { ALL_ON } from '../expansions'

const base = { ...emptyGame, started: true, expansions: ALL_ON,
  players: [{ id: 'a', name: 'a', color: '#fff', score: 0, goods: { wine: 0, grain: 0, cloth: 0 }, gold: 0 }] }
const scoreA = (n: number, id = 'e' + n): GameAction =>
  ({ type: 'addScore', id, playerId: 'a', amount: n, desc: { kind: 'castle', value: n }, timestamp: n })

describe('roomSync', () => {
  it('displays optimistic local actions over confirmed', () => {
    let s = initialSync(base, 0)
    s = applyLocal(s, 'act1', scoreA(5))
    expect(displayedState(s).players[0].score).toBe(5)
    expect(s.confirmed.players[0].score).toBe(0) // confirmed untouched
  })

  it('server echo of own action advances confirmed and clears pending', () => {
    let s = initialSync(base, 0)
    s = applyLocal(s, 'act1', scoreA(5))
    const r = applyServerAction(s, { type: 'action', actionId: 'act1', action: scoreA(5), seq: 1 })
    expect(r.needSnapshot).toBe(false)
    expect(r.state.pending).toHaveLength(0)
    expect(r.state.confirmed.players[0].score).toBe(5)
    expect(r.state.confirmedSeq).toBe(1)
  })

  it('applies another device\'s action on top of confirmed', () => {
    let s = initialSync(base, 0)
    const r = applyServerAction(s, { type: 'action', actionId: 'other', action: scoreA(3), seq: 1 })
    expect(displayedState(r.state).players[0].score).toBe(3)
  })

  it('flags needSnapshot on a seq gap', () => {
    const s = initialSync(base, 0)
    const r = applyServerAction(s, { type: 'action', actionId: 'x', action: scoreA(3), seq: 5 })
    expect(r.needSnapshot).toBe(true)
    expect(r.state).toBe(s) // unchanged
  })

  it('snapshot replaces confirmed and drops acked pending, keeps unacked', () => {
    let s = initialSync(base, 0)
    s = applyLocal(s, 'acked', scoreA(5))
    s = applyLocal(s, 'fresh', scoreA(2))
    const snapped = applySnapshot(s, { type: 'snapshot', state: { ...base, players: [{ ...base.players[0], score: 5 }] }, seq: 1, recentActionIds: ['acked'] })
    expect(snapped.confirmedSeq).toBe(1)
    expect(snapped.pending.map((p) => p.actionId)).toEqual(['fresh'])
    expect(displayedState(snapped).players[0].score).toBe(7) // 5 confirmed + 2 pending
  })
})
