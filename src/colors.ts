export type ColorKey =
  | 'red'
  | 'blue'
  | 'yellow'
  | 'green'
  | 'black'
  | 'pink'
  | 'gray'

/** The standard Carcassonne meeple colors plus the common expansion colors. */
export interface PaletteColor {
  key: ColorKey
  hex: string
}

export const DEFAULT_COLORS: PaletteColor[] = [
  { key: 'red', hex: '#D33A2C' },
  { key: 'blue', hex: '#2C6FD3' },
  { key: 'yellow', hex: '#F2C037' },
  { key: 'green', hex: '#3FA34D' },
  { key: 'black', hex: '#2B2B2B' },
  { key: 'pink', hex: '#E86AA6' },
  { key: 'gray', hex: '#9AA0A6' },
]

/**
 * Returns a readable text color (black or white) for a given background hex,
 * based on perceived luminance.
 */
export function contrastText(hex: string): string {
  const c = hex.replace('#', '')
  const full =
    c.length === 3
      ? c
          .split('')
          .map((ch) => ch + ch)
          .join('')
      : c
  const r = parseInt(full.slice(0, 2), 16)
  const g = parseInt(full.slice(2, 4), 16)
  const b = parseInt(full.slice(4, 6), 16)
  // Perceived luminance (sRGB weighting)
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  return luminance > 0.6 ? '#1a1a1a' : '#ffffff'
}

/** Picks the first palette color not already used by a player. */
export function nextAvailableColor(usedHexes: string[]): string {
  const used = new Set(usedHexes.map((h) => h.toLowerCase()))
  const free = DEFAULT_COLORS.find((c) => !used.has(c.hex.toLowerCase()))
  return free ? free.hex : DEFAULT_COLORS[0].hex
}
