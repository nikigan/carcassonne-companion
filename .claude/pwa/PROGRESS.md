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

Manual / device checks (NOT automatable here — Claude browser extension not connected):
- Live SW registration/activation + install prompt (DevTools > Application).
- Offline toggle -> solo play still works.
- Update toast appears on a new build and only reloads on Refresh.
- iOS Safari > Add to Home Screen shows the castle icon + standalone launch.
