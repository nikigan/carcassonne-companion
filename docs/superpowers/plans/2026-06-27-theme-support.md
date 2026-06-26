# Dark / Light / System Theme Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Dark / Light / System theme choice (persisted, default System) and eliminate the white flash on refresh.

**Architecture:** A semantic neutral palette of Tailwind v4 `@theme` CSS variables whose dark values are the defaults; a `.light` class on `<html>` overrides them, so the same utility reskins the whole app. An inline `<head>` script resolves the theme and paints the correct background before first paint (the flash fix). A `ThemeProvider` (mirroring the existing `LanguageProvider`) owns the choice, applies the class/meta at runtime, and follows the OS in System mode. A cycling icon button in the header switches modes.

**Tech Stack:** React 19 + TypeScript + Vite 6 + Tailwind CSS v4 (`@tailwindcss/vite`), Vitest.

## Global Constraints

- Gate before commit: `npm run build` (tsc -b + vite build) AND `npm run test:run` both green. Verbatim from CLAUDE.md.
- No hard-coded user-facing strings: every new label gets `en` AND `ru` values in the `Strings` interface in `src/i18n.ts` (TS enforces completeness). RU uses official rule terms; theme labels: «Светлая» / «Тёмная» / «Системная».
- Pure/game logic is unit-tested with Vitest (`src/**/*.test.ts`); hooks/components are verified by running the app (no DOM test setup).
- The dark look must be byte-for-byte unchanged after migration (dark token values equal the current literals).
- localStorage key for the theme choice: `carcassonne-companion:theme` (matches existing `:lang` / `:game`).
- Never mention the assistant in commits/comments (CLAUDE.md global rule).

---

## Migration Reference (shared by Tasks 6–8)

After Task 1 defines the tokens, structural neutral utilities are renamed. Apply this **default substitution** to component `className` strings, then apply the **exceptions** below.

**Default substitutions** (BSD-sed-safe via `perl`, `\b` handles both bare and `/alpha` forms because the word boundary sits before `/`):

```bash
perl -pi -e '
  s/\bbg-gray-900\b/bg-canvas/g;
  s/\bbg-gray-800\b/bg-surface/g;
  s/\btext-white\b/text-fg/g;
  s/\bbg-white\//bg-overlay\//g;      # alpha only — bare bg-white handled by exceptions
  s/\bborder-white\b/border-line/g;
  s/\bring-white\b/ring-line/g;
  s/\bbg-black\/60\b/bg-scrim\/60/g;
  s/\bbg-black\/50\b/bg-scrim\/50/g;
  s/\bbg-black\/70\b/bg-scrim\/70/g;
  s/\bbg-black\/30\b/bg-field/g;       # field token bakes the alpha; drop the /30
' <FILE>
```

`text-gray-900` (contrast text on colored chips) is deliberately untouched.

**Exceptions — do NOT apply the blanket `text-white→text-fg`; keep literal `text-white`** (these sit on saturated accents or the camera and must stay white in both themes). After running perl, restore `text-fg`→`text-white` at exactly these spots:

| File:line (current) | Context | Keep |
|---|---|---|
| `PlayerSetup.tsx:136` | `bg-emerald-500 … text-white` (Add/Start) | `text-white` |
| `ScoreModal.tsx:331,665,712,757` | `bg-emerald-500 … text-white` | `text-white` |
| `ScoreModal.tsx:751` | `bg-red-500/80 … text-white` | `text-white` |
| `ColorPicker.tsx:71` | `text-white drop-shadow` over a color swatch | `text-white` |

**Exceptions — keep literal `bg-white`** (perl already skips bare `bg-white`; just confirm):

| File:line | Context | Keep |
|---|---|---|
| `RoomPanel.tsx:24` | `bg-white p-3` — QR code container (scanners need white) | `bg-white` |
| `ExpansionPicker.tsx:45`, `ScoreModal.tsx:309` | `rounded-full bg-white` — toggle-switch knob | `bg-white` |

**Exception — skip `QrScanModal.tsx` entirely.** Its surface is the camera (black in both themes); all its `text-white` / `bg-black*` stay literal. Do not run perl on it.

**Accent-on-tint spot fixes (Task 9), need a `dark:` light-mode override:**

| File | Current | Change to |
|---|---|---|
| `App.tsx` MessageToast | `bg-amber-500/20 … text-amber-50` | `text-amber-900 dark:text-amber-50` |
| `ScoreModal.tsx:751` danger (if low-contrast in light) | `text-white` on `bg-red-500/80` | leave (red-500 is dark enough); re-check visually |

---

## Task 1: Semantic token foundation in `index.css`

**Files:**
- Modify: `src/index.css` (whole file)

**Interfaces:**
- Produces: utilities `bg-canvas`, `bg-surface`, `text-fg`, `bg-overlay`, `border-line`, `ring-line`, `bg-scrim`, `bg-field` (each with `/N` opacity support where used), driven by `.dark`/`.light` on `<html>`; the `dark:` variant (class-based).

- [ ] **Step 1: Replace `src/index.css` with the token foundation**

```css
@import 'tailwindcss';

/* Class-based dark variant: theme is driven by a class on <html>, not the OS
   media query (the inline script in index.html + ThemeProvider set it). `dark:`
   is reserved for the few accent-on-tint spots that need a light override;
   structural neutrals use the semantic tokens below. */
@custom-variant dark (&:where(.dark, .dark *));

/* Semantic neutral palette. Defaults ARE the dark theme (current look is
   unchanged); the `.light` block overrides them. Utilities reference these
   variables at use-site, so flipping the class reskins the whole app. */
@theme {
  --color-canvas: #111827;            /* page background (was gray-900) */
  --color-surface: #1f2937;           /* cards, modals, menus (was gray-800) */
  --color-fg: #ffffff;                /* primary text + /N emphasis (was white) */
  --color-overlay: #ffffff;           /* raised surfaces / hover via /N (was white/N) */
  --color-line: #ffffff;              /* borders + rings via /N (was white/N) */
  --color-scrim: #000000;             /* modal backdrops via /N (was black/N) */
  --color-field: rgb(0 0 0 / 0.3);    /* recessed inputs / segment tracks (was black/30) */
}

.light {
  --color-canvas: #f9fafb;            /* gray-50 */
  --color-surface: #ffffff;
  --color-fg: #111827;                /* gray-900 */
  --color-overlay: #000000;
  --color-line: #000000;
  --color-scrim: #000000;             /* scrims stay dark over content */
  --color-field: rgb(0 0 0 / 0.06);   /* faint inset on white */
}

/* color-scheme drives UA form controls, scrollbars, and the default canvas
   color. :root default is dark; .light flips it. */
:root {
  color-scheme: dark;
}
.light {
  color-scheme: light;
}

html,
body,
#root {
  height: 100%;
}

/* Paint the page canvas to match the app so the bottom safe-area strip and any
   overscroll show the app surface instead of a contrasting band (iOS PWA). */
html {
  @apply bg-canvas;
}

body {
  margin: 0;
  font-family: system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial,
    sans-serif;
  -webkit-tap-highlight-color: transparent;
}

/* Hide spinner on number inputs for a cleaner look */
input[type='number']::-webkit-outer-spin-button,
input[type='number']::-webkit-inner-spin-button {
  -webkit-appearance: none;
  margin: 0;
}
input[type='number'] {
  -moz-appearance: textfield;
  appearance: textfield;
}
```

- [ ] **Step 2: Verify build compiles the new utilities**

Run: `npm run build`
Expected: PASS (no "unknown utility" errors). The app still uses the old `gray-*`/`white/*` literals at this point, so dark look is unchanged.

- [ ] **Step 3: Commit**

```bash
git add src/index.css
git commit -m "Add semantic theme tokens + class-based dark variant"
```

---

## Task 2: Pure theme helpers + tests (TDD)

**Files:**
- Create: `src/theme.ts` (helpers only in this task)
- Create: `src/theme.test.ts`

**Interfaces:**
- Produces: `type ThemeChoice = 'light' | 'dark' | 'system'`; `type ResolvedTheme = 'light' | 'dark'`; `resolveTheme(choice: ThemeChoice, systemPrefersDark: boolean): ResolvedTheme`; `nextTheme(choice: ThemeChoice): ThemeChoice` (cycle order light→dark→system→light); `THEME_STORAGE_KEY = 'carcassonne-companion:theme'`.

- [ ] **Step 1: Write the failing tests**

Create `src/theme.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { nextTheme, resolveTheme } from './theme'

describe('resolveTheme', () => {
  it('returns the explicit choice for light/dark', () => {
    expect(resolveTheme('light', true)).toBe('light')
    expect(resolveTheme('dark', false)).toBe('dark')
  })
  it('follows the system preference when choice is system', () => {
    expect(resolveTheme('system', true)).toBe('dark')
    expect(resolveTheme('system', false)).toBe('light')
  })
})

describe('nextTheme', () => {
  it('cycles light -> dark -> system -> light', () => {
    expect(nextTheme('light')).toBe('dark')
    expect(nextTheme('dark')).toBe('system')
    expect(nextTheme('system')).toBe('light')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test:run -- theme`
Expected: FAIL ("Cannot find module './theme'" / exports undefined).

- [ ] **Step 3: Write the helpers**

Create `src/theme.ts`:

```ts
export type ThemeChoice = 'light' | 'dark' | 'system'
export type ResolvedTheme = 'light' | 'dark'

export const THEME_STORAGE_KEY = 'carcassonne-companion:theme'

/** Concrete appearance for a choice, given the current OS preference. */
export function resolveTheme(
  choice: ThemeChoice,
  systemPrefersDark: boolean,
): ResolvedTheme {
  if (choice === 'system') return systemPrefersDark ? 'dark' : 'light'
  return choice
}

/** Cycle order for the header toggle: light → dark → system → light. */
export function nextTheme(choice: ThemeChoice): ThemeChoice {
  return choice === 'light' ? 'dark' : choice === 'dark' ? 'system' : 'light'
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test:run -- theme`
Expected: PASS (5 assertions).

- [ ] **Step 5: Commit**

```bash
git add src/theme.ts src/theme.test.ts
git commit -m "Add pure theme helpers (resolve/cycle) with tests"
```

---

## Task 3: ThemeProvider + useTheme, wired into the app

**Files:**
- Modify: `src/theme.ts` (append provider/hook + DOM application)
- Modify: `src/main.tsx`

**Interfaces:**
- Consumes: `resolveTheme`, `nextTheme`, `THEME_STORAGE_KEY`, types from Task 2.
- Produces: `ThemeProvider({ children })`; `useTheme(): { theme: ThemeChoice; resolved: ResolvedTheme; setTheme(c: ThemeChoice): void; cycle(): void }`; `CANVAS_COLOR: Record<ResolvedTheme, string>` (exported so the inline script values stay documented). Side effect: applies `.dark`/`.light` class, `<html>` inline background, and `<meta name="theme-color">` on change.

- [ ] **Step 1: Append the provider + hook to `src/theme.ts`**

Add these imports at the top of `src/theme.ts`:

```ts
import {
  createContext,
  createElement,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'
```

Append to `src/theme.ts`:

```ts
/** Canvas background per resolved theme — must match --color-canvas in index.css
 *  and the inline pre-paint script in index.html. */
export const CANVAS_COLOR: Record<ResolvedTheme, string> = {
  dark: '#111827',
  light: '#f9fafb',
}

const DARK_MQ = '(prefers-color-scheme: dark)'

function systemPrefersDark(): boolean {
  try {
    return window.matchMedia(DARK_MQ).matches
  } catch {
    return true // dark is the historical default
  }
}

function readStoredChoice(): ThemeChoice {
  try {
    const v = localStorage.getItem(THEME_STORAGE_KEY)
    if (v === 'light' || v === 'dark' || v === 'system') return v
  } catch {
    // ignore
  }
  return 'system'
}

/** Apply a resolved theme to the document: class, inline canvas background
 *  (covers the moment before/independent of CSS), and the status-bar meta. */
function applyResolved(resolved: ResolvedTheme): void {
  const root = document.documentElement
  root.classList.remove('dark', 'light')
  root.classList.add(resolved)
  root.style.backgroundColor = CANVAS_COLOR[resolved]
  const meta = document.querySelector('meta[name="theme-color"]')
  if (meta) meta.setAttribute('content', CANVAS_COLOR[resolved])
}

interface ThemeContextValue {
  theme: ThemeChoice
  resolved: ResolvedTheme
  setTheme: (choice: ThemeChoice) => void
  cycle: () => void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemeChoice>(() => readStoredChoice())
  // Re-render when the OS preference flips while in system mode.
  const [systemDark, setSystemDark] = useState<boolean>(() => systemPrefersDark())

  useEffect(() => {
    try {
      const mq = window.matchMedia(DARK_MQ)
      const onChange = (e: MediaQueryListEvent) => setSystemDark(e.matches)
      mq.addEventListener('change', onChange)
      return () => mq.removeEventListener('change', onChange)
    } catch {
      return
    }
  }, [])

  const resolved = resolveTheme(theme, systemDark)

  useEffect(() => {
    try {
      localStorage.setItem(THEME_STORAGE_KEY, theme)
    } catch {
      // ignore
    }
    applyResolved(resolved)
  }, [theme, resolved])

  const value: ThemeContextValue = {
    theme,
    resolved,
    setTheme: setThemeState,
    cycle: () => setThemeState((c) => nextTheme(c)),
  }

  return createElement(ThemeContext.Provider, { value }, children)
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used within a ThemeProvider')
  return ctx
}
```

- [ ] **Step 2: Wrap `<App/>` in `ThemeProvider` in `src/main.tsx`**

```tsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { LanguageProvider } from './i18n.ts'
import { ThemeProvider } from './theme.ts'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <LanguageProvider>
        <App />
      </LanguageProvider>
    </ThemeProvider>
  </StrictMode>,
)
```

- [ ] **Step 3: Verify build + tests**

Run: `npm run build && npm run test:run`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/theme.ts src/main.tsx
git commit -m "Add ThemeProvider/useTheme; apply theme to document"
```

---

## Task 4: Inline pre-paint script in `index.html` (flash fix)

**Files:**
- Modify: `index.html`

**Interfaces:**
- Consumes: `THEME_STORAGE_KEY` value `'carcassonne-companion:theme'` and `CANVAS_COLOR` hexes (`#111827` / `#f9fafb`) — duplicated here intentionally because this runs before any module loads.

- [ ] **Step 1: Add the script in `<head>` immediately before the module `<script>`**

In `index.html`, inside `<head>` (after the `theme-color` meta), add:

```html
<script>
  // Resolve and apply the theme before first paint to avoid a white flash.
  // Mirrors src/theme.ts (THEME_STORAGE_KEY, CANVAS_COLOR, resolveTheme).
  (function () {
    try {
      var choice = localStorage.getItem('carcassonne-companion:theme') || 'system'
      var dark =
        choice === 'dark' ||
        (choice === 'system' &&
          window.matchMedia('(prefers-color-scheme: dark)').matches)
      var root = document.documentElement
      root.classList.add(dark ? 'dark' : 'light')
      var canvas = dark ? '#111827' : '#f9fafb'
      root.style.backgroundColor = canvas
      var meta = document.querySelector('meta[name="theme-color"]')
      if (meta) meta.setAttribute('content', canvas)
    } catch (e) {}
  })()
</script>
```

- [ ] **Step 2: Verify build + manual flash check**

Run: `npm run build && npm run preview`
Expected: Build PASS. In the browser, hard-refresh several times in dark mode — the first paint is dark (`#111827`), no white flash. (Verified more thoroughly in Task 9.)

- [ ] **Step 3: Commit**

```bash
git add index.html
git commit -m "Paint resolved theme before first paint (fix refresh flash)"
```

---

## Task 5: i18n theme strings

**Files:**
- Modify: `src/i18n.ts` (interface + `en` + `ru`)

**Interfaces:**
- Produces: `t.themeLight`, `t.themeDark`, `t.themeSystem` (strings) and `t.themeToggleAria(current: string)` (function) on `Strings`.

- [ ] **Step 1: Add to the `Strings` interface** (after `soundLabel: string` near line 189)

```ts
  // Theme toggle
  themeLight: string
  themeDark: string
  themeSystem: string
  themeToggleAria: (current: string) => string
```

- [ ] **Step 2: Add to the `en` table** (after `soundLabel: 'Sound',`)

```ts
  themeLight: 'Light',
  themeDark: 'Dark',
  themeSystem: 'System',
  themeToggleAria: (current) => `Theme: ${current}. Tap to switch.`,
```

- [ ] **Step 3: Add to the `ru` table** (after `soundLabel: 'Звук',`)

```ts
  themeLight: 'Светлая',
  themeDark: 'Тёмная',
  themeSystem: 'Системная',
  themeToggleAria: (current) => `Тема: ${current}. Нажмите, чтобы сменить.`,
```

- [ ] **Step 4: Verify build (TS enforces both tables)**

Run: `npm run build`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/i18n.ts
git commit -m "Add localized theme-toggle strings (en/ru)"
```

---

## Task 6: ThemeToggle + header wiring + migrate `App.tsx`

**Files:**
- Modify: `src/App.tsx`

**Interfaces:**
- Consumes: `useTheme`, `useI18n`. Renders a `<button>` beside the language toggle.

- [ ] **Step 1: Migrate `App.tsx` structural neutrals**

Run the Migration Reference perl on `src/App.tsx`, then restore exceptions (App.tsx has none of the `text-white` keep-list — its bare `text-white` at root line 42 and active-segment line 70 both convert to `text-fg`).

```bash
perl -pi -e '
  s/\bbg-gray-900\b/bg-canvas/g;
  s/\bbg-gray-800\b/bg-surface/g;
  s/\btext-white\b/text-fg/g;
  s/\bbg-white\//bg-overlay\//g;
  s/\bborder-white\b/border-line/g;
  s/\bring-white\b/ring-line/g;
  s/\bbg-black\/60\b/bg-scrim\/60/g;
' src/App.tsx
git --no-pager diff src/App.tsx   # eyeball: only neutral classes changed
```

- [ ] **Step 2: Add `import { useTheme } from './theme'` and the `ThemeToggle` component**

At the bottom of `src/App.tsx` (beside `MenuItem`):

```tsx
function ThemeToggle() {
  const { t } = useI18n()
  const { theme, cycle } = useTheme()
  const icon = theme === 'light' ? '☀️' : theme === 'dark' ? '🌙' : '🖥️'
  const label =
    theme === 'light' ? t.themeLight : theme === 'dark' ? t.themeDark : t.themeSystem
  return (
    <button
      onClick={cycle}
      className="rounded-lg bg-overlay/5 px-2 py-1 text-base leading-none hover:bg-overlay/10"
      aria-label={t.themeToggleAria(label)}
      title={label}
    >
      <span aria-hidden>{icon}</span>
    </button>
  )
}
```

- [ ] **Step 3: Place `<ThemeToggle />` in the header**, immediately after the language segmented control `</div>` (after current line 78, before the `{room && (` block):

```tsx
            </div>

            <ThemeToggle />

            {room && (
```

Add `useTheme` import: `import { useTheme } from './theme'`.

- [ ] **Step 4: Verify build + tests**

Run: `npm run build && npm run test:run`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/App.tsx
git commit -m "Add theme toggle to header; migrate App.tsx to theme tokens"
```

---

## Task 7: Migrate `Scoreboard.tsx` + `ScoreModal.tsx`

**Files:**
- Modify: `src/components/Scoreboard.tsx`, `src/components/ScoreModal.tsx`

- [ ] **Step 1: Run the perl substitution on both files**

```bash
for f in src/components/Scoreboard.tsx src/components/ScoreModal.tsx; do
perl -pi -e '
  s/\bbg-gray-900\b/bg-canvas/g;
  s/\bbg-gray-800\b/bg-surface/g;
  s/\btext-white\b/text-fg/g;
  s/\bbg-white\//bg-overlay\//g;
  s/\bborder-white\b/border-line/g;
  s/\bring-white\b/ring-line/g;
  s/\bbg-black\/60\b/bg-scrim\/60/g;
  s/\bbg-black\/30\b/bg-field/g;
' "$f"; done
```

- [ ] **Step 2: Restore `text-white` exceptions in `ScoreModal.tsx`**

Edit these four emerald buttons and one red button back to `text-white` (perl turned them into `text-fg`): the action buttons at the former lines 331, 665, 712, 757 (all `bg-emerald-500 … text-white`) and 751 (`bg-red-500/80 … text-white`). Use the editor: replace `bg-emerald-500 …text-fg` → `…text-white` and `bg-red-500/80 …text-fg` → `…text-white` on those button elements only.

(`Scoreboard.tsx:197` `hover:text-white` SHOULD become `hover:text-fg` — leave as migrated. The `rounded-full bg-white` switch knob at `ScoreModal.tsx:309` stays literal — perl did not touch bare `bg-white`.)

- [ ] **Step 3: Verify build + tests, eyeball the diff**

Run: `git --no-pager diff src/components/Scoreboard.tsx src/components/ScoreModal.tsx && npm run build && npm run test:run`
Expected: PASS; diff shows only neutral-class renames + the restored `text-white` buttons.

- [ ] **Step 4: Commit**

```bash
git add src/components/Scoreboard.tsx src/components/ScoreModal.tsx
git commit -m "Migrate Scoreboard & ScoreModal to theme tokens"
```

---

## Task 8: Migrate remaining components

**Files:**
- Modify: `src/components/PlayerSetup.tsx`, `ColorPicker.tsx`, `ExpansionPicker.tsx`, `RoomPanel.tsx`, `UpdatePrompt.tsx`
- Do NOT touch: `src/components/QrScanModal.tsx` (camera surface — stays literal)

- [ ] **Step 1: Run the perl substitution on the five files**

```bash
for f in src/components/PlayerSetup.tsx src/components/ColorPicker.tsx src/components/ExpansionPicker.tsx src/components/RoomPanel.tsx src/components/UpdatePrompt.tsx; do
perl -pi -e '
  s/\bbg-gray-900\b/bg-canvas/g;
  s/\bbg-gray-800\b/bg-surface/g;
  s/\btext-white\b/text-fg/g;
  s/\bbg-white\//bg-overlay\//g;
  s/\bborder-white\b/border-line/g;
  s/\bring-white\b/ring-line/g;
  s/\bbg-black\/60\b/bg-scrim\/60/g;
  s/\bbg-black\/30\b/bg-field/g;
' "$f"; done
```

- [ ] **Step 2: Restore `text-white` exceptions**

- `PlayerSetup.tsx:136` — Add/Start button `bg-emerald-500 … text-white`: restore `text-fg`→`text-white`.
- `ColorPicker.tsx:71` — `text-white drop-shadow` over the custom-color swatch: restore `text-fg`→`text-white`.
- (`PlayerSetup.tsx:189,197` secondary buttons on `bg-overlay/10` — leave as `text-fg`. `RoomPanel.tsx:24` `bg-white` QR container — perl left it literal; confirm. `ExpansionPicker.tsx:45` & the switch knobs — `bg-white` stays literal.)

- [ ] **Step 3: Verify build + tests, eyeball diffs**

Run: `git --no-pager diff src/components && npm run build && npm run test:run`
Expected: PASS; only neutral renames + restored `text-white`.

- [ ] **Step 4: Commit**

```bash
git add src/components/PlayerSetup.tsx src/components/ColorPicker.tsx src/components/ExpansionPicker.tsx src/components/RoomPanel.tsx src/components/UpdatePrompt.tsx
git commit -m "Migrate remaining components to theme tokens"
```

---

## Task 9: Accent spot-fixes, full visual verification, docs

**Files:**
- Modify: `src/App.tsx` (MessageToast), possibly `ScoreModal.tsx` / others per visual check
- Modify: `CLAUDE.md`

- [ ] **Step 1: Audit grep — any leftover literal neutral is a missed migration**

Run:
```bash
grep -rn "text-white\b\|bg-gray-[0-9]\|bg-white/\|border-white\|ring-white\|bg-black/30\|bg-gray-800\|bg-gray-900" src --include="*.tsx" | grep -v "QrScanModal"
```
Expected: only the intentional literals — `bg-white` switch knobs (`ExpansionPicker.tsx`, `ScoreModal.tsx`), `bg-white` QR container (`RoomPanel.tsx`), and the restored `text-white` accent buttons. Investigate anything else.

- [ ] **Step 2: Fix accent-on-tint contrast for light mode**

In `App.tsx` MessageToast, change `text-amber-50` → `text-amber-900 dark:text-amber-50` (near-white text is invisible on the pale amber tint in light mode).

- [ ] **Step 3: Visual verification of both themes (mobile viewport)**

Run `npm run dev`, open in Chrome at a phone width. For EACH of System(→light), Light, Dark:
- Setup screen (players, color picker, expansions, room buttons)
- Scoreboard (player cards, score log, token tallies)
- ScoreModal — Features / Goods / Manual tabs; emerald/red action buttons readable
- Menu dropdown, Expansions modal, Room panel (QR stays white), Update toast, Message toast
- Toggle cycles ☀️→🌙→🖥️ and the icon/aria update; switching OS appearance flips System live.
- Hard-refresh in dark and in light: first paint matches, no white flash.

Fix any low-contrast spot with a targeted `dark:` override; re-run `npm run build`.

- [ ] **Step 4: Document the convention in `CLAUDE.md`**

Under "Key conventions", add a short subsection:

```markdown
### Theming (dark / light / system)
Appearance is driven by a `.dark`/`.light` class on `<html>`. Structural neutral
colors use **semantic tokens** defined in `src/index.css` (`bg-canvas`,
`bg-surface`, `text-fg`, `bg-overlay/N`, `border-line/N`, `ring-line/N`,
`bg-scrim/N`, `bg-field`) — dark values are the defaults, `.light` overrides them.
Do NOT add raw `bg-gray-*` / `text-white` / `white/N` for neutrals; use a token so
both themes work. Saturated-accent buttons keep literal `text-white`; the camera
(`QrScanModal`) and the QR container stay literal. Theme state lives in
`src/theme.ts` (`ThemeProvider`/`useTheme`, mirrors `LanguageProvider`); an inline
script in `index.html` paints the resolved canvas before first paint (flash fix) —
keep its hexes in sync with `--color-canvas` / `CANVAS_COLOR`.
```

- [ ] **Step 5: Final gate + commit**

Run: `npm run build && npm run test:run`
Expected: PASS.

```bash
git add -A
git commit -m "Light-mode contrast fixes; document theming convention"
```

---

## Self-Review

- **Spec coverage:** modes/default System (Tasks 2,3,4) ✓; cycling icon toggle in header (Task 6) ✓; semantic tokens over `dark:` (Task 1, Migration Reference) ✓; persistence key (Task 2) ✓; flash fix inline script (Task 4) ✓; ThemeProvider mirrors LanguageProvider (Task 3) ✓; i18n en/ru (Task 5) ✓; accent spot-fixes + audit + docs (Task 9) ✓; unit tests for resolve/cycle (Task 2) ✓.
- **Placeholder scan:** none — every step has concrete code/commands.
- **Type consistency:** `ThemeChoice`/`ResolvedTheme`/`resolveTheme`/`nextTheme`/`THEME_STORAGE_KEY`/`CANVAS_COLOR`/`ThemeProvider`/`useTheme` used identically across Tasks 2,3,4,6.
- **Known cascade risk:** if `.light` overrides don't apply (theme layer precedence), raise specificity to `:root.light`. Visual check in Task 9 Step 3 catches it.
