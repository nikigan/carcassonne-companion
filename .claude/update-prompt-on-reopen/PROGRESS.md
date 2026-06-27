# Update prompt on app reopen (without restart)

## Problem
The "new version → Refresh" toast (`src/components/UpdatePrompt.tsx`) only
appeared after a full app restart. The browser checks for a new service worker
only at registration time (page load). When the installed PWA is reopened from
the background it *resumes* rather than reloads (notably on iOS), so a freshly
deployed build went unnoticed until a restart.

## Change
`src/components/UpdatePrompt.tsx`:
- Capture the `ServiceWorkerRegistration` via the `onRegisteredSW(swUrl, r)`
  callback of `useRegisterSW`, stored in a ref.
- Added a `useEffect` that listens for `visibilitychange` + window `focus` and
  calls `registration.update()` when the app returns to the foreground.
  Guards: only when document is visible, not while `installing`, and skip when
  `navigator.onLine === false`.
- If a newer SW exists, `onNeedRefresh` flips `needRefresh` → toast shows, no
  restart needed. Still `registerType: 'prompt'`, so nothing reloads until the
  user taps Refresh.

API confirmed against vite-plugin-pwa docs (onRegisteredSW available v0.12.8+).

## Status: DONE
- `npm run build` clean (tsc strict + vite build).
- `npm run test:run` green (34/34).

## Note / future option
A periodic `setInterval(() => r.update(), 60*60*1000)` inside `onRegisteredSW`
could also catch updates during a long-lived session. Not added — the request
was specifically the reopen case. Easy to add later if wanted.
