import { describe, expect, it } from 'vitest'
import { nextTheme, resolveTheme } from './theme'

describe('resolveTheme', () => {
  it('returns the explicit choice for light/dark', () => {
    expect(resolveTheme('light', true)).toBe('light')
    expect(resolveTheme('dark', false)).toBe('dark')
  })
  it('follows the system preference when choice is system', () => {
    expect(resolveTheme('system', true)).toBe('dark')
    expect(resolveTheme('system', false)).toBe('light')
  })
})

describe('nextTheme', () => {
  it('cycles light -> dark -> system -> light', () => {
    expect(nextTheme('light')).toBe('dark')
    expect(nextTheme('dark')).toBe('system')
    expect(nextTheme('system')).toBe('light')
  })
})
