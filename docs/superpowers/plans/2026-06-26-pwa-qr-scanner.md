# In-app QR Scanner Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a player join a multiplayer room by scanning the host's QR from *inside* the installed PWA, so joining no longer depends on the OS opening the URL in a browser (impossible to route into a PWA on iOS).

**Architecture:** A self-contained `QrScanModal` component owns the entire camera concern (start rear camera, decode QR frames via the `qr-scanner` library, parse the value into a validated room code, always stop the stream on close). It is wired into the existing pre-game setup screen and feeds the **existing** `onJoinRoom(code)` handler — no changes to `useRoom` or the multiplayer protocol. Plus three Android-only web-app-manifest hints as a free, no-op-on-iOS bonus.

**Tech Stack:** React 19 + TypeScript (strict) + Vite 6 + Tailwind CSS v4 + `vite-plugin-pwa`; new dependency `qr-scanner@^1.4.2` (Nimiq).

## Global Constraints

- **Build is the only gate:** `npm run build` (runs `tsc -b` strict + `vite build`) must stay green. There is **no test runner or linter** in this repo — do not add test files; verify via the build plus manual/browser smoke tests. (Per `CLAUDE.md`.)
- **`node_modules` is not installed in this worktree** — Task 1 runs `npm install`. `npm run build` will fail until it does.
- **Everything user-facing is localized:** no hard-coded UI strings. Add a key to the `Strings` interface in `src/i18n.ts` and provide **both** `en` and `ru` values (TypeScript enforces completeness). Russian "room" = «комната»; "QR" stays "QR".
- **Reuse the existing room-code validator** `roomCodeFromPath` from `src/game/protocol.ts` (regex `^/r/([A-Za-z0-9]+)/?$`, 6 chars, alphabet `ABCDEFGHJKMNPQRSTUVWXYZ23456789`). Do not re-implement code validation.
- **Reuse the existing `t.close` string** ('Close' / 'Закрыть') for the close button — do not add a new close/cancel key.
- **Never mention the assistant** in commits/comments (per the user's global rule). Repo commits carry **no** trailers — match that (verified in `git log`).
- The Scan button and modal appear **only when `!inRoom`** (the existing block in `PlayerSetup.tsx`).

---

### Task 1: Install dependencies + add `qr-scanner`

**Files:**
- Modify: `package.json` (dependencies), `package-lock.json`

**Interfaces:**
- Consumes: nothing.
- Produces: the `qr-scanner` module (default export `QrScanner`) available to import; a working `node_modules` so `npm run build` can run.

- [ ] **Step 1: Install existing deps + the new one**

```bash
npm install
npm install qr-scanner@^1.4.2
```

- [ ] **Step 2: Verify the build is green (baseline + new dep resolves)**

Run: `npm run build`
Expected: completes with no TypeScript errors and a `dist/` (or `dist/client`) output. (The dep isn't imported yet; this just confirms a clean baseline.)

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "Add qr-scanner dependency"
```

---

### Task 2: Add localized scanner strings

**Files:**
- Modify: `src/i18n.ts` — the `Strings` interface (~line 158, "Multiplayer / room" section), the `en` table (~line 324), and the `ru` table (~line 494).

**Interfaces:**
- Consumes: nothing.
- Produces: `t.scanQr`, `t.scanQrHint`, `t.scanCameraDenied`, `t.scanNoCamera`, `t.scanInvalidQr` (all `string`) for use in Tasks 3–4.

- [ ] **Step 1: Add the keys to the `Strings` interface**

In the `// Multiplayer / room` block of the `interface Strings`, after `scanToJoin: string`, add:

```ts
  scanQr: string
  scanQrHint: string
  scanCameraDenied: string
  scanNoCamera: string
  scanInvalidQr: string
```

- [ ] **Step 2: Add the `en` values**

In the `const en: Strings` object, after the `scanToJoin: 'Scan to join',` line, add:

```ts
  scanQr: 'Scan QR',
  scanQrHint: 'Point at the room QR',
  scanCameraDenied: 'Camera access denied. Enable it in settings, or join by code.',
  scanNoCamera: 'No camera available. Join by code instead.',
  scanInvalidQr: "That's not a room QR.",
```

- [ ] **Step 3: Add the `ru` values**

In the `const ru: Strings` object, after the `scanToJoin: 'Отсканируйте, чтобы войти',` line, add:

```ts
  scanQr: 'Сканировать QR',
  scanQrHint: 'Наведите на QR-код комнаты',
  scanCameraDenied: 'Доступ к камере запрещён. Разрешите его в настройках или войдите по коду.',
  scanNoCamera: 'Камера недоступна. Войдите по коду.',
  scanInvalidQr: 'Это не QR-код комнаты.',
```

- [ ] **Step 4: Verify the build is green**

Run: `npm run build`
Expected: no errors. (If a key is missing from `en` or `ru`, strict TS fails here — that's the completeness check.)

- [ ] **Step 5: Commit**

```bash
git add src/i18n.ts
git commit -m "Add localized strings for the QR scanner"
```

---

### Task 3: Create the `QrScanModal` component

**Files:**
- Create: `src/components/QrScanModal.tsx`

**Interfaces:**
- Consumes: `QrScanner` (default export from `qr-scanner`); `roomCodeFromPath` from `../game/protocol`; `useI18n` from `../i18n`; the strings from Task 2.
- Produces: `export function QrScanModal(props: { onResult: (code: string) => void; onClose: () => void }): JSX.Element` — used by Task 4. Fires `onResult` exactly once with a validated 6-char code, then `onClose`.

**Design notes for the implementer:**
- The scanned QR holds a full URL like `https://carcassonne.gankin.xyz/r/ABC123`. The pure helper `codeFromScan` parses URL / relative-path / bare-code forms through `roomCodeFromPath` and returns a validated code or `null`.
- Keep `onResult`/`onClose` in refs and run the camera effect **once** (`[]` deps) so inline parent callbacks don't restart the camera on every render — the same ref pattern `useRoom.ts` uses.
- `scanner.start()` triggers the camera permission prompt and rejects on denial/no-camera → show the localized error. Always `scanner.destroy()` on unmount so the camera indicator never lingers.
- `qr-scanner`'s worker is bundled automatically by Vite in 1.4.x — no `WORKER_PATH` needed.

- [ ] **Step 1: Write the full component**

```tsx
import { useEffect, useRef, useState } from 'react'
import QrScanner from 'qr-scanner'
import { roomCodeFromPath } from '../game/protocol'
import { useI18n } from '../i18n'

interface Props {
  /** Fired once with a validated 6-char room code. */
  onResult: (code: string) => void
  /** Close the sheet (cancel button, or after a successful result). */
  onClose: () => void
}

/**
 * Parse a scanned QR payload into a validated room code, or null.
 * Accepts a full URL (`https://host/r/ABC123`), a relative path (`/r/ABC123`),
 * or a bare code (`ABC123`) — all validated through `roomCodeFromPath`.
 */
function codeFromScan(value: string): string | null {
  const raw = value.trim()
  try {
    const fromUrl = roomCodeFromPath(new URL(raw).pathname)
    if (fromUrl) return fromUrl
  } catch {
    // not a URL — fall through to path/bare-code handling
  }
  return roomCodeFromPath(raw.startsWith('/') ? raw : `/r/${raw}`)
}

type ScanError = 'denied' | 'noCamera'

/**
 * Full-screen camera sheet that decodes a room QR and hands back the room code.
 * Owns the entire camera lifecycle; the stream is always stopped on unmount.
 */
export function QrScanModal({ onResult, onClose }: Props) {
  const { t } = useI18n()
  const videoRef = useRef<HTMLVideoElement>(null)
  const [error, setError] = useState<ScanError | null>(null)
  const [sawInvalid, setSawInvalid] = useState(false)

  // Keep the latest callbacks in refs so the camera effect can run once and
  // never restarts when the parent passes fresh inline handlers.
  const onResultRef = useRef(onResult)
  onResultRef.current = onResult
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    let scanner: QrScanner | null = null
    let cancelled = false
    let handled = false

    QrScanner.hasCamera()
      .then((has) => {
        if (cancelled) return
        if (!has) {
          setError('noCamera')
          return
        }
        scanner = new QrScanner(
          video,
          (result) => {
            if (handled) return
            const code = codeFromScan(result.data)
            if (!code) {
              setSawInvalid(true)
              return
            }
            handled = true
            scanner?.stop()
            onResultRef.current(code)
            onCloseRef.current()
          },
          {
            preferredCamera: 'environment',
            highlightScanRegion: true,
            maxScansPerSecond: 5,
            returnDetailedScanResult: true,
            onDecodeError: () => {
              // Frames without a QR fire this constantly; ignore them.
            },
          },
        )
        scanner.start().catch(() => {
          if (!cancelled) setError('denied')
        })
      })
      .catch(() => {
        if (!cancelled) setError('noCamera')
      })

    return () => {
      cancelled = true
      scanner?.destroy()
    }
  }, [])

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black">
      <video
        ref={videoRef}
        className="h-full w-full object-cover"
        playsInline
        muted
      />

      {/* Top bar: close button, honoring the safe-area inset. */}
      <div className="absolute inset-x-0 top-0 flex justify-end p-[max(0.75rem,env(safe-area-inset-top))]">
        <button
          type="button"
          onClick={onClose}
          className="rounded-full bg-black/50 px-4 py-2 text-sm font-semibold text-white backdrop-blur hover:bg-black/70"
        >
          {t.close}
        </button>
      </div>

      {/* Bottom hint / error, honoring the safe-area inset. */}
      <div className="absolute inset-x-0 bottom-0 p-[max(1.25rem,env(safe-area-inset-bottom))]">
        <div className="mx-auto max-w-md rounded-xl bg-black/60 px-4 py-3 text-center text-sm font-medium text-white backdrop-blur">
          {error === 'denied' && t.scanCameraDenied}
          {error === 'noCamera' && t.scanNoCamera}
          {!error && (sawInvalid ? t.scanInvalidQr : t.scanQrHint)}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify the build is green**

Run: `npm run build`
Expected: no TypeScript errors; `qr-scanner` types resolve; the component compiles. (The component isn't rendered yet — this confirms it type-checks and the worker import resolves under Vite.)

- [ ] **Step 3: Commit**

```bash
git add src/components/QrScanModal.tsx
git commit -m "Add QrScanModal: in-app camera QR scanner"
```

---

### Task 4: Wire the scanner into the setup screen

**Files:**
- Modify: `src/components/PlayerSetup.tsx`

**Interfaces:**
- Consumes: `QrScanModal` from `./QrScanModal` (Task 3); the existing `onJoinRoom: (code: string) => void` prop; `t.scanQr` (Task 2).
- Produces: a user-reachable "Scan QR" button that opens the modal; on a successful scan it calls the existing `onJoinRoom`.

- [ ] **Step 1: Import the modal**

At the top of `src/components/PlayerSetup.tsx`, after the existing `import { ExpansionPicker } from './ExpansionPicker'` line, add:

```ts
import { QrScanModal } from './QrScanModal'
```

- [ ] **Step 2: Add scanning state**

Inside the component, next to the existing `const [joinCode, setJoinCode] = useState('')` line, add:

```ts
  const [scanning, setScanning] = useState(false)
```

- [ ] **Step 3: Add the Scan button below the join-code row**

In the `!inRoom` block, the join row currently ends with `</div>` after the Join `<button>`. Immediately **after** that closing `</div>` (the `flex gap-2` row) and still inside the `<>…</>` fragment, add the Scan button:

```tsx
              <button
                type="button"
                onClick={() => setScanning(true)}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-white/10 py-2.5 text-sm font-semibold text-white hover:bg-white/15"
              >
                <span aria-hidden>▣</span> {t.scanQr}
              </button>
```

- [ ] **Step 4: Render the modal**

Still inside the `!inRoom` fragment (after the Scan button), add the conditional modal. It is `position: fixed`, so its placement in the tree doesn't matter:

```tsx
              {scanning && (
                <QrScanModal
                  onResult={(code) => onJoinRoom(code)}
                  onClose={() => setScanning(false)}
                />
              )}
```

(`QrScanModal` already calls `onClose` after a successful `onResult`, so `scanning` resets on a good scan.)

- [ ] **Step 5: Verify the build is green**

Run: `npm run build`
Expected: no errors.

- [ ] **Step 6: Browser smoke test**

Run: `npm run preview` (serves the production build over HTTPS-eligible localhost; camera APIs are allowed on `localhost`).
Then, in a desktop browser with a webcam:
1. On the setup screen, confirm a **"Scan QR"** button appears under the join-code input.
2. In a second tab/device, create a room and display its QR (the existing share QR).
3. Click "Scan QR", grant the camera, and point the webcam at the QR.
Expected: the sheet closes and the app joins that room (room status goes connecting → connected, the room code matches). Also confirm: clicking "Close" stops the camera (the browser camera indicator turns off), and pointing at a non-room QR shows "That's not a room QR." without closing.

- [ ] **Step 7: Commit**

```bash
git add src/components/PlayerSetup.tsx
git commit -m "Add a Scan QR button to the join flow"
```

---

### Task 5: Android manifest link-handling hints

**Files:**
- Modify: `vite.config.ts` — the `manifest` object inside the `VitePWA({ … })` call (~lines 18–44).

**Interfaces:**
- Consumes: nothing.
- Produces: a generated `manifest.webmanifest` containing `id`, `launch_handler`, and `handle_links`.

**Note:** `id` is a standard manifest member and almost certainly typed. `launch_handler` / `handle_links` may not yet be in `vite-plugin-pwa`'s `ManifestOptions` type, so the merged manifest is asserted with `as` to stay strict-clean. These fields are ignored by browsers that don't support them (all of iOS) — zero risk.

- [ ] **Step 1: Add `id` to the manifest**

Inside the `manifest: { … }` object, alongside `start_url: '/'` and `scope: '/'`, add:

```ts
        id: '/',
```

- [ ] **Step 2: Add the link-handling fields via a type-safe assertion**

The two newer members go on the manifest object. To avoid a type error if they aren't in the installed `ManifestOptions`, append them and assert the manifest. Change the `manifest:` property so it reads (keep all existing fields; only the trailing two keys + the cast are new):

```ts
      manifest: {
        name: 'Carcassonne Companion',
        short_name: 'Carcassonne',
        description: "A web companion app for the board game Carcassonne to track each player's score.",
        lang: 'en',
        id: '/',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        theme_color: '#1f2937',
        background_color: '#1f2937',
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'pwa-maskable-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
        // Android-only: let Chrome route in-scope `/r/<code>` links into the
        // installed PWA (gated by the user's "Open supported links" setting).
        // Ignored everywhere it isn't supported (incl. all of iOS).
        launch_handler: { client_mode: ['navigate-existing', 'auto'] },
        handle_links: 'preferred',
      } as Parameters<typeof VitePWA>[0]['manifest'],
```

If `npm run build` instead reports that `launch_handler`/`handle_links` *are* valid members (no error), the `as …` cast is harmless and may stay.

- [ ] **Step 3: Verify the build is green**

Run: `npm run build`
Expected: no TypeScript errors; build succeeds.

- [ ] **Step 4: Confirm the fields land in the generated manifest**

Run: `grep -o 'launch_handler\|handle_links\|"id"' dist/client/manifest.webmanifest 2>/dev/null || grep -o 'launch_handler\|handle_links\|"id"' dist/manifest.webmanifest`
Expected: prints `"id"`, `launch_handler`, and `handle_links` (the build emits to `dist/client` per the @cloudflare/vite-plugin setup; the fallback covers a plain `dist`).

- [ ] **Step 5: Commit**

```bash
git add vite.config.ts
git commit -m "Add Android PWA link-handling manifest hints"
```

---

### Task 6: Document the scanner

**Files:**
- Modify: `CLAUDE.md` (the `## PWA` section)

**Interfaces:**
- Consumes: nothing. Produces: updated project docs.

- [ ] **Step 1: Note the in-app scanner in the PWA section**

In `CLAUDE.md`, at the end of the `## PWA` section's prose (before the "Design spec:" line), add a sentence:

```md
An **in-app QR scanner** (`src/components/QrScanModal.tsx`, using `qr-scanner`)
lets a player join a room by scanning the host's QR from inside the PWA — the OS
cannot route a scanned URL into an installed PWA on iOS, so the in-app camera is
the only cross-platform path. The manifest also carries Android-only
`launch_handler`/`handle_links` hints for in-scope link capture.
```

- [ ] **Step 2: Verify the build is still green**

Run: `npm run build`
Expected: no errors (docs-only change, but confirm nothing else regressed).

- [ ] **Step 3: Commit**

```bash
git add CLAUDE.md
git commit -m "Document the in-app QR scanner"
```

---

## Self-Review

**Spec coverage:**
- Behavior (Scan QR button on setup, `!inRoom`, camera sheet) → Task 4. ✅
- `QrScanModal` with narrow props + decode→`roomCodeFromPath` + always-stop camera → Task 3. ✅
- Library `qr-scanner`, no `BarcodeDetector` dependence → Tasks 1, 3. ✅
- Wiring feeds existing `onJoinRoom`, no `useRoom`/protocol change → Task 4. ✅
- i18n keys, en+ru, reuse `t.close` → Task 2 (+ reuse noted in constraints). ✅
- Android manifest `id`/`launch_handler`/`handle_links`, TS-safe → Task 5. ✅
- Error states (denied / no-camera / invalid) localized → Tasks 2, 3. ✅
- Verification = `npm run build` + browser smoke; no test files → every task + Task 4 Step 6. ✅
- Docs note (CLAUDE.md) → Task 6 (listed in spec "Files touched"). ✅

**Placeholder scan:** No TBD/TODO; every code step contains complete code and exact commands. ✅

**Type consistency:** `codeFromScan(value: string): string | null` and `QrScanModal({ onResult, onClose })` are used identically in Tasks 3 and 4; `roomCodeFromPath` signature matches `protocol.ts`; new i18n keys defined in Task 2 are the same ones referenced in Tasks 3–4. ✅
