import { useRegisterSW } from 'virtual:pwa-register/react'
import { useI18n } from '../i18n'

/**
 * Bottom toast shown when a new app version has been precached. We use
 * registerType 'prompt', so nothing reloads until the user taps Refresh.
 */
export function UpdatePrompt() {
  const { t } = useI18n()
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW()

  // Keep the live region mounted at all times and only toggle its contents, so
  // screen readers reliably announce the toast when `needRefresh` flips true.
  // The empty wrapper must not intercept taps, hence pointer-events-none here
  // and pointer-events-auto on the card.
  return (
    <div
      role="status"
      className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center px-4 pb-[max(1rem,env(safe-area-inset-bottom))]"
    >
      {needRefresh && (
        <div className="pointer-events-auto flex w-full max-w-md items-center justify-between gap-3 rounded-xl border border-line/10 bg-surface px-4 py-3 shadow-2xl">
          <span className="text-sm text-fg/90">{t.updateAvailable}</span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => updateServiceWorker(true)}
              className="rounded-lg bg-overlay/15 px-3 py-1.5 text-sm font-semibold text-fg hover:bg-overlay/25"
            >
              {t.refresh}
            </button>
            <button
              onClick={() => setNeedRefresh(false)}
              className="rounded-lg px-2 py-1.5 text-sm text-fg/50 hover:bg-overlay/10"
              aria-label={t.close}
            >
              ✕
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
