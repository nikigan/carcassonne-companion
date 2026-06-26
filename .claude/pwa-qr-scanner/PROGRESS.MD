# In-app QR scanner — progress

**Goal:** Join a multiplayer room by scanning the host's QR from inside the PWA
(OS cannot route a scanned URL into an installed PWA on iOS).

**Spec:** `docs/superpowers/specs/2026-06-26-pwa-qr-scanner-design.md`
**Plan:** `docs/superpowers/plans/2026-06-26-pwa-qr-scanner.md`

## Status — COMPLETE

- [x] Task 1 — install deps + add `qr-scanner@1.4.2`
- [x] Task 2 — localized scanner strings (en + ru)
- [x] Task 3 — `src/components/QrScanModal.tsx`
- [x] Task 4 — wire Scan QR button into `PlayerSetup.tsx`
- [x] Task 5 — Android manifest hints in `vite.config.ts`
- [x] Task 6 — document in `CLAUDE.md`

## Verification

- `npm run build` green throughout; `qr-scanner-worker.min` chunk bundles under Vite.
- `codeFromScan` parsing verified against a faithful copy of `roomCodeFromPath`
  (11 cases: URL/relative/bare/whitespace/trailing-slash/unrelated/short/ambiguous/junk — all pass).
- Browser smoke test (dev server): Scan QR button renders; modal opens full-screen;
  no-camera path shows localized message + Close; Close returns to setup.
- **Caught + fixed:** overlay was pinned to the `backdrop-blur` action bar
  (a `position:fixed` containing block) → now renders via `createPortal` to `<body>`.

## Still needs a real device

Camera *decode* (scan a host QR → join) can't be exercised in headless Chrome
(no camera). Verify on a phone: open the installed PWA → Scan QR → point at a
host's room QR → should join. iOS re-prompts camera permission each open (expected).

## Notes

- Library: `qr-scanner@^1.4.2`, ESM default import, `returnDetailedScanResult: true`.
- `ManifestOptions` in the installed `vite-plugin-pwa` already types
  `launch_handler`/`handle_links` — no cast needed.
