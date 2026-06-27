import { useEffect, useRef } from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'
import { useI18n } from '../i18n'

/**
 * Bottom toast shown when a new app version has been precached. We use
 * registerType 'prompt', so nothing reloads until the user taps Refresh.
 */
export function UpdatePrompt() {
  const { t } = useI18n()
  const registrationRef = useRef<ServiceWorkerRegistration | null>(null)
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_swUrl, r) {
      registrationRef.current = r ?? null
    },
  })

  // The browser only checks for a new service worker at registration time (page
  // load). When the installed PWA is reopened from the background it resumes
  // instead of reloading — especially on iOS — so a fresh build would otherwise
  // go unnoticed until a full restart. Re-check whenever the app returns to the
  // foreground; if a newer SW exists, `onNeedRefresh` flips `needRefresh` and
  // the toast appears without a restart.
  useEffect(() => {
    const checkForUpdate = () => {
      const r = registrationRef.current
      if (!r || document.visibilityState !== 'visible') return
      // Don't spam the network while installing or offline.
      if (r.installing) return
      if ('connection' in navigator && !navigator.onLine) return
      void r.update()
    }
    document.addEventListener('visibilitychange', checkForUpdate)
    window.addEventListener('focus', checkForUpdate)
    return () => {
      document.removeEventListener('visibilitychange', checkForUpdate)
      window.removeEventListener('focus', checkForUpdate)
    }
  }, [])

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
