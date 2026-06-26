import { useState } from 'react'
import type { Player } from '../types'
import type { ExpansionConfig, ExpansionId } from '../expansions'
import { contrastText, nextAvailableColor } from '../colors'
import { useI18n } from '../i18n'
import { ColorPicker } from './ColorPicker'
import { ExpansionPicker } from './ExpansionPicker'

interface Props {
  players: Player[]
  expansions: ExpansionConfig
  onAdd: (name: string, color: string) => void
  onUpdate: (id: string, patch: Partial<Pick<Player, 'name' | 'color'>>) => void
  onRemove: (id: string) => void
  onToggleExpansion: (id: ExpansionId, on: boolean) => void
  onStart: () => void
  onCreateRoom: () => void
  onJoinRoom: (code: string) => void
  /** Hide the create/join controls when this device is already in a room. */
  inRoom: boolean
}

/** Pre-game screen: add/edit/remove players and their colors, then start. */
export function PlayerSetup({
  players,
  expansions,
  onAdd,
  onUpdate,
  onRemove,
  onToggleExpansion,
  onStart,
  onCreateRoom,
  onJoinRoom,
  inRoom,
}: Props) {
  const { t } = useI18n()
  const usedHexes = players.map((p) => p.color)
  const [name, setName] = useState('')
  const [color, setColor] = useState(() => nextAvailableColor(usedHexes))
  const [joinCode, setJoinCode] = useState('')

  const submit = () => {
    onAdd(name.trim() || t.defaultPlayerName(players.length + 1), color)
    setName('')
    // Advance to the next free color so back-to-back adds don't collide.
    setColor(nextAvailableColor([...usedHexes, color]))
  }

  return (
    <div className="mx-auto w-full max-w-md px-4 pb-28 pt-6">
      <h2 className="mb-1 text-2xl font-bold">{t.playersHeading}</h2>
      <p className="mb-5 text-sm text-white/60">{t.playersHint}</p>

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
              aria-label={t.playerNameAria}
            />
            <details className="relative">
              <summary className="cursor-pointer list-none rounded-lg px-2 py-1 text-xs text-white/60 hover:bg-white/10">
                {t.colorLabel}
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
              aria-label={t.removePlayerAria(p.name)}
            >
              ✕
            </button>
          </li>
        ))}
        {players.length === 0 && (
          <li className="rounded-xl border border-dashed border-white/10 p-4 text-center text-sm text-white/40">
            {t.noPlayers}
          </li>
        )}
      </ul>

      <div className="rounded-2xl bg-white/5 p-4">
        <div className="mb-3 flex gap-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && submit()}
            placeholder={t.playerNamePlaceholder}
            className="min-w-0 flex-1 rounded-lg bg-black/30 px-3 py-2 text-base outline-none ring-1 ring-white/10 focus:ring-white/30"
          />
          <button
            type="button"
            onClick={submit}
            className="shrink-0 rounded-lg bg-emerald-500 px-4 py-2 font-semibold text-white transition hover:bg-emerald-400 active:scale-95"
          >
            {t.add}
          </button>
        </div>
        <ColorPicker value={color} onChange={setColor} usedHexes={usedHexes} />
      </div>

      <div className="mt-6">
        <h3 className="mb-1 text-sm font-semibold uppercase tracking-wide text-white/40">
          {t.expansionsTitle}
        </h3>
        <p className="mb-3 text-xs text-white/50">{t.expansionsHint}</p>
        <ExpansionPicker config={expansions} onToggle={onToggleExpansion} />
      </div>

      <div className="fixed inset-x-0 bottom-0 border-t border-white/10 bg-gray-900/90 p-4 backdrop-blur">
        <div className="mx-auto w-full max-w-md space-y-2">
          <button
            type="button"
            onClick={onStart}
            disabled={players.length === 0}
            className="block w-full rounded-xl bg-amber-500 py-3 text-lg font-bold text-gray-900 transition enabled:hover:bg-amber-400 enabled:active:scale-[0.98] disabled:opacity-40"
          >
            {t.startGame}
          </button>
          {!inRoom && (
            <>
              <button
                type="button"
                onClick={onCreateRoom}
                className="block w-full rounded-xl bg-white/5 py-2.5 text-sm font-medium text-white/70 hover:bg-white/10"
              >
                {t.playOnMultipleDevices}
              </button>
              <div className="pt-0.5 text-xs font-medium text-white/40">{t.joinByCode}</div>
              <div className="flex gap-2">
                <input
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                  onKeyDown={(e) => { if (e.key === 'Enter' && joinCode.length > 0) { onJoinRoom(joinCode); setJoinCode('') } }}
                  placeholder={t.enterCode}
                  maxLength={6}
                  className="min-w-0 flex-1 rounded-lg bg-black/30 px-3 py-2 text-sm font-mono tracking-widest outline-none ring-1 ring-white/10 focus:ring-white/30 uppercase"
                />
                <button
                  type="button"
                  onClick={() => { if (joinCode.length > 0) { onJoinRoom(joinCode); setJoinCode('') } }}
                  className="shrink-0 rounded-lg bg-white/10 px-4 py-2 text-sm font-semibold text-white hover:bg-white/15"
                >
                  {t.join}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
