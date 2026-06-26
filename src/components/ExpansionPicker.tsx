import { EXPANSIONS, type ExpansionConfig, type ExpansionId } from '../expansions'
import { useI18n } from '../i18n'

interface Props {
  config: ExpansionConfig
  onToggle: (id: ExpansionId, on: boolean) => void
}

/**
 * List of expansion on/off rows. The base game is always in play and so is not
 * listed. Used both pre-game (PlayerSetup) and in-game (the menu modal).
 */
export function ExpansionPicker({ config, onToggle }: Props) {
  const { t } = useI18n()
  return (
    <ul className="space-y-1.5">
      {EXPANSIONS.map(({ id, emoji }) => {
        const on = config[id]
        return (
          <li key={id}>
            <button
              type="button"
              role="switch"
              aria-checked={on}
              onClick={() => onToggle(id, !on)}
              className="flex w-full items-center gap-3 rounded-xl bg-white/5 p-3 text-left transition hover:bg-white/10 active:scale-[0.99]"
            >
              <span className="text-xl leading-none" aria-hidden>
                {emoji}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold">
                  {t.expansionNames[id]}
                </span>
                <span className="block text-xs text-white/50">
                  {t.expansionDescriptions[id]}
                </span>
              </span>
              <span
                className={`relative h-6 w-11 shrink-0 rounded-full transition ${
                  on ? 'bg-emerald-500' : 'bg-white/20'
                }`}
              >
                <span
                  className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition ${
                    on ? 'left-[1.375rem]' : 'left-0.5'
                  }`}
                />
              </span>
            </button>
          </li>
        )
      })}
    </ul>
  )
}
