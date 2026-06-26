import { describe, expect, it } from 'vitest'
import { kindCanTriggerMessage, messageQualifies } from './messageTrigger'

describe('messageQualifies', () => {
  it('fires when the points scored are a multiple of 5 (messenger move)', () => {
    expect(messageQualifies(5, 5)).toBe(true)
    expect(messageQualifies(10, 17)).toBe(true) // amount ÷5 regardless of total
  })

  it('fires when the new total is a multiple of 5 (meeple landing)', () => {
    expect(messageQualifies(2, 5)).toBe(true) // 3 -> 5
    expect(messageQualifies(3, 15)).toBe(true)
  })

  it('does not fire when neither the points nor the total are a multiple of 5', () => {
    expect(messageQualifies(3, 3)).toBe(false)
    expect(messageQualifies(7, 7)).toBe(false) // passes 5, lands on 7
  })

  it('ignores zero and negative changes (no forward landing)', () => {
    expect(messageQualifies(0, 5)).toBe(false)
    expect(messageQualifies(-1, 5)).toBe(false)
  })
})

describe('kindCanTriggerMessage', () => {
  it('excludes end-of-game tallies (gold, trade goods)', () => {
    expect(kindCanTriggerMessage('gold')).toBe(false)
    expect(kindCanTriggerMessage('goodsBonus')).toBe(false)
  })

  it('allows in-play feature and manual scores', () => {
    for (const kind of [
      'road',
      'city',
      'cloister',
      'field',
      'castle',
      'message',
      'circus',
      'acrobats',
      'ringmaster',
      'manual',
    ] as const) {
      expect(kindCanTriggerMessage(kind)).toBe(true)
    }
  })
})
