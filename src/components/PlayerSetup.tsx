import { useState } from 'react'
import type { Player } from '../types'
import { contrastText, nextAvailableColor } from '../colors'
import { ColorPicker } from './ColorPicker'

interface Props {
  players: Player[]
  onAdd: (name: string, color: string) => void
  onUpdate: (id: string, patch: Partial<Pick<Player, 'name' | 'color'>>) => void
  onRemove: (id: string) => void
  onStart: () => void
}

/** Pre-game screen: add/edit/remove players and their colors, then start. */
export function PlayerSetup({ players, onAdd, onUpdate, onRemove, onStart }: Props) {
  const usedHexes = players.map((p) => p.color)
  const [name, setName] = useState('')
  const [color, setColor] = useState(() => nextAvailableColor(usedHexes))

  const submit = () => {
    onAdd(name, color)
    setName('')
    // Advance to the next free color so back-to-back adds don't collide.
    setColor(nextAvailableColor([...usedHexes, color]))
  }

  return (
    <div className="mx-auto w-full max-w-md px-4 pb-28 pt-6">
      <h2 className="mb-1 text-2xl font-bold">Players</h2>
      <p className="mb-5 text-sm text-white/60">
        Add everyone playing and pick a color for each.
      </p>

      <ul className="mb-5 space-y-2">
        {players.map((p) => (
          <li
            key={p.id}
            className="flex items-center gap-3 rounded-xl bg-white/5 p-2.5"
          >
            <span
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold"
              style={{ backgroundColor: p.color, color: contrastText(p.color) }}
            >
              {p.name.charAt(0).toUpperCase() || '?'}
            </span>
            <input
              value={p.name}
              onChange={(e) => onUpdate(p.id, { name: e.target.value })}
              className="min-w-0 flex-1 bg-transparent text-base font-medium outline-none"
              aria-label="Player name"
            />
            <details className="relative">
              <summary className="cursor-pointer list-none rounded-lg px-2 py-1 text-xs text-white/60 hover:bg-white/10">
                Color
              </summary>
              <div className="absolute right-0 z-10 mt-2 w-64 rounded-xl border border-white/10 bg-gray-800 p-3 shadow-xl">
                <ColorPicker
                  value={p.color}
                  onChange={(hex) => onUpdate(p.id, { color: hex })}
                  usedHexes={usedHexes.filter((h) => h !== p.color)}
                />
              </div>
            </details>
            <button
              type="button"
              onClick={() => onRemove(p.id)}
              className="rounded-lg px-2 py-1 text-white/40 hover:bg-white/10 hover:text-red-400"
              aria-label={`Remove ${p.name}`}
            >
              ✕
            </button>
          </li>
        ))}
        {players.length === 0 && (
          <li className="rounded-xl border border-dashed border-white/10 p-4 text-center text-sm text-white/40">
            No players yet — add your first below.
          </li>
        )}
      </ul>

      <div className="rounded-2xl bg-white/5 p-4">
        <div className="mb-3 flex gap-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && submit()}
            placeholder="Player name"
            className="min-w-0 flex-1 rounded-lg bg-black/30 px-3 py-2 text-base outline-none ring-1 ring-white/10 focus:ring-white/30"
          />
          <button
            type="button"
            onClick={submit}
            className="shrink-0 rounded-lg bg-emerald-500 px-4 py-2 font-semibold text-white transition hover:bg-emerald-400 active:scale-95"
          >
            Add
          </button>
        </div>
        <ColorPicker value={color} onChange={setColor} usedHexes={usedHexes} />
      </div>

      <div className="fixed inset-x-0 bottom-0 border-t border-white/10 bg-gray-900/90 p-4 backdrop-blur">
        <button
          type="button"
          onClick={onStart}
          disabled={players.length === 0}
          className="mx-auto block w-full max-w-md rounded-xl bg-amber-500 py-3 text-lg font-bold text-gray-900 transition enabled:hover:bg-amber-400 enabled:active:scale-[0.98] disabled:opacity-40"
        >
          Start game
        </button>
      </div>
    </div>
  )
}
