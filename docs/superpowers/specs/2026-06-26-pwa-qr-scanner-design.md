# In-app QR scanner for joining rooms

**Date:** 2026-06-26
**Status:** Approved (design)

## Problem

The multiplayer QR code encodes a full room URL (`https://carcassonne.gankin.xyz/r/<CODE>`).
When a player scans it with their phone's **camera app**, the OS hands the URL to
the default **browser** — never to the installed PWA. The user wants the QR to
open the app instead of the browser.

### Why OS-level routing can't deliver this

Researched 2026-06-26:

- **iOS:** deep-linking a scanned URL into an installed home-screen PWA is
  *impossible*. iOS always opens web links in Safari, even when the URL is inside
  the PWA's scope. The only exception is push notifications on iOS 16.4+. Safari
  does not support the manifest fields (`launch_handler` / `handle_links` /
  `capture_links`) that would change this. A PWA opened from its icon vs. from a
  Safari link also runs in *separate* storage contexts, so a handoff would lose
  the joiner's local identity/remembered rooms anyway.
  Sources: Progressier PWA deep-links guide; WICG/pwa-url-handler #43; web.dev
  web-app-manifest; firt.dev PWA tips.
- **Android (Chrome):** installed PWAs *can* capture in-scope links, and
  `launch_handler`/`handle_links` help, but it still depends on the user's
  "Open supported links" toggle.

### Why an in-app scanner is the fix, and is viable

- It never relies on OS link routing, so it works on **iOS and Android**.
- Camera (`getUserMedia`) works in iOS home-screen standalone PWAs since
  **iOS 13.4** (WebKit bug 185448 RESOLVED FIXED). Caveat: iOS does not persist
  camera permission for PWAs, so it re-prompts each time the scanner opens —
  acceptable for an occasional "join" action.
  Source: bugs.webkit.org #185448.
- `BarcodeDetector` is **not** supported in Safari (iOS/macOS), so decoding must
  use a JS/WASM library rather than the native API.
  Source: STRICH KB; can I use BarcodeDetector.

## Scope

**In:** an in-app QR scanner on the pre-game setup screen that decodes a room QR
and joins that room; plus Android-only manifest hints as a free bonus.

**Out (YAGNI):** torch/flash toggle, camera picker, multi-format barcodes, any
change to QR *generation*, the `/r/<code>` routing, `useRoom`, or the multiplayer
protocol.

## Design

### 1. User-facing behavior

On the pre-game setup screen, **only when not already in a room** (the existing
`!inRoom` block in `PlayerSetup.tsx`), add a **"Scan QR"** button beside the
existing "Join by code" input. Tapping it opens a full-screen camera sheet with a
viewfinder. Pointing at the host's QR decodes the room code, auto-joins, and
closes the sheet. The existing code-entry and link-sharing paths are unchanged.

### 2. New component — `src/components/QrScanModal.tsx`

Self-contained; owns the entire camera concern behind a narrow interface.

- **Props:**
  - `onResult(code: string): void` — fired once with a validated 6-char code.
  - `onClose(): void` — closes the sheet (cancel button, backdrop, or after a
    successful result).
- **Lifecycle:** start the rear-facing camera (`preferredCamera: 'environment'`)
  when the sheet opens; **always stop the stream** on unmount/close so the camera
  indicator never lingers.
- **Decode → code:** the QR holds `https://…/r/ABC123`. Parse with the existing
  validator: `roomCodeFromPath(new URL(value).pathname)`; if that's null, fall
  back to `roomCodeFromPath('/r/' + value.trim())` to also accept a bare code or
  relative path. A non-room QR yields null → keep scanning and show a transient
  "not a room QR" hint (do not close). On the first valid code: call
  `onResult(code)` then `onClose()`.
- **Library:** `qr-scanner` (Nimiq) — small (~12 KB + worker), bundles camera +
  worker-based decoding, and does **not** require `BarcodeDetector`, so it is
  consistent on iOS. The exact current API and the Vite worker setup
  (worker import/path) will be confirmed against the library's live docs before
  coding.
- **Error states (all localized):** permission denied, no camera available,
  insecure context (non-HTTPS). Each shows a short message pointing the user to
  "Join by code" as the fallback, plus a close button.

### 3. Wiring — `src/components/PlayerSetup.tsx`

- Add local `const [scanning, setScanning] = useState(false)`.
- Add a "Scan QR" button inside the existing `!inRoom` block, next to the join
  input; it calls `setScanning(true)`.
- Render `{scanning && <QrScanModal onResult={...} onClose={() => setScanning(false)} />}`.
- `onResult(code)` calls the **same** `onJoinRoom(code)` prop the manual input
  already uses, then `setScanning(false)`. No new join path; no changes to
  `useRoom.ts`.

### 4. i18n — `src/i18n.ts`

Add to the `Strings` interface in the "Multiplayer / room" section, with **both**
`en` and `ru` values (TypeScript enforces completeness):

| key | en | ru |
| --- | --- | --- |
| `scanQr` | Scan QR | Сканировать QR |
| `scanQrHint` | Point at the room QR | Наведите на QR-код комнаты |
| `scanCameraDenied` | Camera access denied. Enable it in settings, or join by code. | Доступ к камере запрещён. Разрешите его в настройках или войдите по коду. |
| `scanNoCamera` | No camera available. Join by code instead. | Камера недоступна. Войдите по коду. |
| `scanInvalidQr` | That's not a room QR. | Это не QR-код комнаты. |
| `scanClose` | Close | Закрыть |

(If a suitable generic "close"/"cancel" key already exists, reuse it instead of
adding `scanClose`.) "Room" stays «комната», consistent with existing strings.

### 5. Android manifest bonus — `vite.config.ts`

Add to the `manifest` object inside the `VitePWA({ ... })` call:

```js
id: '/',
launch_handler: { client_mode: ['navigate-existing', 'auto'] },
handle_links: 'preferred',
```

Lets Android Chrome route in-scope `/r/<code>` links into the installed PWA
(still gated by the user's "Open supported links" setting). No-op on iOS, zero
risk. If the `vite-plugin-pwa` manifest TS types reject these fields, apply a
narrow type-cast so `npm run build` stays strict-clean.

## Error handling

- Camera permission denied → `scanCameraDenied`, keep sheet open with a close
  button.
- No camera / enumerate fails → `scanNoCamera`.
- Non-secure context → treat as no camera (`scanNoCamera`); production is HTTPS
  and dev is `localhost`, both allowed.
- Decoded value is not a valid room code → transient `scanInvalidQr`, keep
  scanning.

## Testing & verification

- **Gate:** `npm run build` (tsc strict + vite build) must stay green.
- The decode→code parsing is pure (reuses `roomCodeFromPath`) and will be
  sanity-checked.
- Camera UI smoke-tested in a desktop browser with a webcam by scanning a
  generated room QR.
- No test runner exists in this repo, so no unit-test files are added
  (consistent with the codebase).

## Files touched

- `src/components/QrScanModal.tsx` — new.
- `src/components/PlayerSetup.tsx` — add the button + sheet wiring.
- `src/i18n.ts` — new localized strings (en + ru).
- `vite.config.ts` — manifest `id` / `launch_handler` / `handle_links`.
- `package.json` / lockfile — add `qr-scanner`.
- `CLAUDE.md` (PWA section) — note the in-app scanner once shipped.
