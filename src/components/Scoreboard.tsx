import { useState } from 'react'
import type { GameState } from '../types'
import { contrastText } from '../colors'
import { ScoreModal } from './ScoreModal'

interface Props {
  state: GameState
  onScore: (playerId: string, amount: number, label: string) => void
  onUndo: (entryId: string) => void
}

/** The in-game view: ranked player cards + quick actions + score log. */
export function Scoreboard({ state, onScore, onUndo }: Props) {
  const [activeId, setActiveId] = useState<string | null>(null)
  const active = state.players.find((p) => p.id === activeId) ?? null

  // Rank by score (desc), keeping original order for ties.
  const ranked = [...state.players].sort((a, b) => b.score - a.score)
  const leadScore = ranked.length ? ranked[0].score : 0

  const nameById = (id: string) =>
    state.players.find((p) => p.id === id)?.name ?? 'Unknown'
  const colorById = (id: string) =>
    state.players.find((p) => p.id === id)?.color ?? '#666'

  return (
    <div className="mx-auto w-full max-w-md px-4 pb-10 pt-4">
      <div className="space-y-2.5">
        {ranked.map((p, i) => {
          const isLeader = p.score === leadScore && leadScore > 0
          return (
            <div
              key={p.id}
              className="flex items-center gap-3 rounded-2xl bg-white/5 p-3"
            >
              <span className="w-5 text-center text-sm font-bold text-white/40">
                {i + 1}
              </span>
              <span
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-lg font-bold"
                style={{ backgroundColor: p.color, color: contrastText(p.color) }}
              >
                {p.name.charAt(0).toUpperCase() || '?'}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 truncate font-semibold">
                  {p.name}
                  {isLeader && <span title="Leading">👑</span>}
                </div>
                <div className="text-3xl font-black tabular-nums leading-tight">
                  {p.score}
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => onScore(p.id, -1, 'Manual −1')}
                  className="h-10 w-10 rounded-xl bg-white/10 text-xl font-bold hover:bg-white/20 active:scale-95"
                  aria-label={`Subtract a point from ${p.name}`}
                >
                  −
                </button>
                <button
                  onClick={() => onScore(p.id, 1, 'Manual +1')}
                  className="h-10 w-10 rounded-xl bg-white/10 text-xl font-bold hover:bg-white/20 active:scale-95"
                  aria-label={`Add a point to ${p.name}`}
                >
                  +
                </button>
                <button
                  onClick={() => setActiveId(p.id)}
                  className="h-10 rounded-xl bg-amber-500 px-3 text-sm font-bold text-gray-900 hover:bg-amber-400 active:scale-95"
                >
                  Score
                </button>
              </div>
            </div>
          )
        })}
      </div>

      <div className="mt-8">
        <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-white/40">
          Score log
        </h3>
        {state.log.length === 0 ? (
          <p className="rounded-xl border border-dashed border-white/10 p-4 text-center text-sm text-white/30">
            No points scored yet.
          </p>
        ) : (
          <ul className="space-y-1.5">
            {state.log.slice(0, 50).map((e) => (
              <li
                key={e.id}
                className="flex items-center gap-2.5 rounded-lg bg-white/5 px-3 py-2 text-sm"
              >
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: colorById(e.playerId) }}
                />
                <span className="font-medium">{nameById(e.playerId)}</span>
                <span className="min-w-0 flex-1 truncate text-white/50">
                  {e.label}
                </span>
                <span
                  className={`shrink-0 font-bold tabular-nums ${
                    e.amount >= 0 ? 'text-emerald-400' : 'text-red-400'
                  }`}
                >
                  {e.amount > 0 ? '+' : ''}
                  {e.amount}
                </span>
                <button
                  onClick={() => onUndo(e.id)}
                  className="shrink-0 rounded px-1.5 py-0.5 text-xs text-white/40 hover:bg-white/10 hover:text-white/80"
                  aria-label="Undo this entry"
                >
                  undo
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {active && (
        <ScoreModal
          player={active}
          onClose={() => setActiveId(null)}
          onScore={(amount, label) => onScore(active.id, amount, label)}
        />
      )}
    </div>
  )
}
