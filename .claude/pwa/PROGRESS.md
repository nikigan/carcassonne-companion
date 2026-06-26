# PWA Support — Progress

Plan: docs/superpowers/plans/2026-06-26-pwa.md
Spec: docs/superpowers/specs/2026-06-26-pwa-design.md

- [x] Task 1: Generate app icons
- [x] Task 2: Install + configure vite-plugin-pwa (manifest, SW, iOS meta)
- [x] Task 3: Update-prompt UX (i18n + component + wiring)
- [x] Task 4: End-to-end verification

## Verification (2026-06-26)

Automatable checks — PASS:
- `npm run build` green; generateSW precaches 16 entries (app shell + all icons).
- manifest.webmanifest: correct name/short_name/display:standalone/theme+bg #1f2937/3 icons (incl. maskable).
- index.html: manifest link + apple-touch-icon + 3 apple-mobile-web-app-* meta.
- sw.js: NavigationRoute index.html fallback WITH /api/ denylist; precache covers index.html, JS, CSS, all icons, favicon, manifest.
- Preview server (http://localhost:4173) serves over HTTP: manifest (application/manifest+json), sw.js (text/javascript), all 4 icons (image/png), SPA deep-link /r/<code> -> index.html.

Live in-browser checks (Chrome, http://localhost:4173) — PASS:
- Service worker registers, reaches `activated`, scope `/`, and controls the page after one reload (controllerScriptURL = /sw.js).
- Browser parsed the manifest; Workbox precache populated (app shell + all icons).
- OFFLINE proof: with the preview server killed, reloading still rendered the full app (root content, header, 19–20 interactive controls) — solo play works offline.
- OFFLINE deep link: navigating to /r/<code> with the server down served the cached SPA shell via navigateFallback.
- Update flow: a new build put the new SW into `waiting`; the localized toast appeared («Доступно обновление. Обновить» / "A new version is available. Refresh") with NO auto-reload (registerType 'prompt'). Clicking Refresh activated the new SW, loaded the new bundle, and dismissed the toast.

Remaining (real-device only, optional):
- iOS Safari > Add to Home Screen shows the castle icon + standalone launch.
