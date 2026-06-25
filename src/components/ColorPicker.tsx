import { DEFAULT_COLORS } from '../colors'

interface Props {
  value: string
  onChange: (hex: string) => void
  /** Colors already taken by other players (shown but marked). */
  usedHexes?: string[]
}

/**
 * Swatch grid of the default Carcassonne colors plus a native custom color
 * input. Selecting either updates `value`.
 */
export function ColorPicker({ value, onChange, usedHexes = [] }: Props) {
  const used = new Set(usedHexes.map((h) => h.toLowerCase()))
  const valueIsCustom = !DEFAULT_COLORS.some(
    (c) => c.hex.toLowerCase() === value.toLowerCase(),
  )

  return (
    <div className="flex flex-wrap items-center gap-2">
      {DEFAULT_COLORS.map((c) => {
        const selected = c.hex.toLowerCase() === value.toLowerCase()
        const taken = used.has(c.hex.toLowerCase()) && !selected
        return (
          <button
            key={c.hex}
            type="button"
            title={taken ? `${c.name} (in use)` : c.name}
            aria-label={c.name}
            aria-pressed={selected}
            onClick={() => onChange(c.hex)}
            className={`relative h-9 w-9 rounded-full border-2 transition ${
              selected
                ? 'border-white ring-2 ring-white/70 scale-110'
                : 'border-white/20 hover:border-white/50'
            }`}
            style={{ backgroundColor: c.hex }}
          >
            {taken && (
              <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-white/80">
                •
              </span>
            )}
          </button>
        )
      })}

      <label
        className={`relative flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border-2 ${
          valueIsCustom ? 'border-white ring-2 ring-white/70' : 'border-white/20'
        }`}
        title="Custom color"
        style={{
          background: valueIsCustom
            ? value
            : 'conic-gradient(red, orange, yellow, lime, cyan, blue, magenta, red)',
        }}
      >
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="absolute inset-0 cursor-pointer opacity-0"
          aria-label="Choose a custom color"
        />
        {!valueIsCustom && (
          <span className="pointer-events-none text-sm font-bold text-white drop-shadow">
            +
          </span>
        )}
      </label>
    </div>
  )
}
