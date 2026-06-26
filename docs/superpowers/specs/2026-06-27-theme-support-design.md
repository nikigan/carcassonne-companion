# Dark / Light / System Theme — Design

**Date:** 2026-06-27
**Status:** Approved, pending implementation

## Goal

Let the player choose the app's appearance — **Dark**, **Light**, or **System**
(follow the OS) — instead of the current dark-only look, and persist that choice.
While doing so, fix the **white flash on refresh**: the page briefly paints white
before the bundled CSS loads, which is jarring in the dark.

The two are connected — the flash fix is the same mechanism the theme system
needs: resolve the theme and paint the correct background *before* first paint.

## Decisions (locked)

- **Modes:** `light | dark | system`. Default for a first-time visitor (no saved
  choice) is **`system`** (follow the OS until the user picks a fixed mode).
- **Toggle UI:** a single **cycling icon button** in the header, beside the EN/RU
  language toggle, styled to match it. Shows the current mode's icon and cycles
  on tap: ☀️ Light → 🌙 Dark → 🖥️ System → ☀️.
- **Light-mode strategy:** **semantic neutral tokens** (Tailwind v4 `@theme` CSS
  variables that flip with a `.light` class), not inline `dark:` variants on
  every utility.
- **Persistence:** `localStorage` key `carcassonne-companion:theme` (matches the
  existing `:lang` / `:game` keys).
- **Scope:** solo and room play alike — purely client-side appearance, no
  protocol/state changes. The dark look is unchanged (dark values are the
  defaults).

## Approach

### Semantic neutral palette

Today ~154 hardcoded dark neutral utilities are spread across 9 files (page =
`gray-900`, cards/menus = `gray-800`, text = `white` at various opacities, raised
surfaces = `white/5–25`, borders/rings = `white/10`, scrims = `black/30–70`).

Introduce a small semantic palette as Tailwind v4 `@theme` CSS variables. The
**dark values are the defaults** (so the current look is byte-for-byte unchanged);
a `.light` class on `<html>` overrides them. The same utility renders dark or
light purely from the root class — no per-element variant for structural
neutrals.

| Token utility | Replaces | Dark (default) | Light |
|---|---|---|---|
| `bg-canvas` (+ `/N`) | `gray-900` (+ `/N`) | `#111827` | `#f9fafb` |
| `bg-surface` | `gray-800` | `#1f2937` | `#ffffff` |
| `text-fg` (+ `/N`) | `white` (+ `/N`) | `#ffffff` | `#111827` |
| `bg-overlay/N`, `border-line/N`, `ring-line/N` | `white/N` | white-alpha | black-alpha |
| `bg-scrim/N` | `black/N` | black-alpha | black-alpha (kept dark) |

Opacity modifiers (`text-fg/50`, `bg-overlay/10`) work on CSS-variable-backed
theme colors via Tailwind v4's `color-mix(in oklab, …)` generation.

`@custom-variant dark (&:where(.dark, .dark *))` is also defined so `dark:` is
available for the **few accent-on-tint spots** that read poorly on a light
canvas (e.g. the amber message toast's near-white text). Those get a targeted
`dark:` override; everything structural uses the tokens.

Accent colors (green status dot, amber toast, red danger), player-swatch
contrast text, and `contrastText` in `colors.ts` stay literal — they are
theme-independent or spot-tuned.

**Alternative considered — inline `dark:` variants** (`bg-white dark:bg-gray-900`
on every site): more Tailwind-idiomatic but doubles class noise across 154 sites,
scatters the palette through markup, and is harder to audit (leftover darks look
intentional). Rejected for maintainability. With the token approach, any leftover
`text-white` / `bg-gray-*` / `bg-white/*` in components after migration is a
detectable bug.

### Flash fix — inline head script

A tiny synchronous `<script>` in `<head>`, before the module script, runs before
first paint:

1. Read `localStorage['carcassonne-companion:theme']` (default `system`).
2. Resolve `system` via `matchMedia('(prefers-color-scheme: dark)')`.
3. Add `.dark` or `.light` to `document.documentElement`.
4. Set an inline `background-color` on `<html>` (correct even before the bundled
   CSS loads) and sync `<meta name="theme-color">`.

The inline background hex must match each theme's `--color-canvas`; this small
duplication is intentional and documented. Once the CSS loads, `html { @apply
bg-canvas }` takes over with the same color.

### Theme state — `src/theme.ts`

Mirror `LanguageProvider`/`useI18n` exactly:

- `ThemeProvider` (context) + `useTheme()` exposing `{ theme, resolved,
  setTheme, cycle }`.
- On mount and on change: persist the choice, resolve it, apply the `.dark`/
  `.light` class to `<html>`, update `<meta name="theme-color">`, and keep the
  inline `<html>` background in sync (so a runtime toggle repaints correctly).
- When `theme === 'system'`, subscribe to the `matchMedia` change event and
  re-resolve live; unsubscribe otherwise.
- Pure, exported helpers `resolveTheme(choice, systemPrefersDark)` →
  `'dark' | 'light'` and `nextTheme(choice)` (the cycle order), unit-tested.

### Toggle component

A `ThemeToggle` button in the header beside the language toggle, same styling
(`rounded-lg bg-overlay/5 …`). Renders the current mode's icon, calls `cycle()`
on click, and carries a localized `aria-label` announcing the current mode. New
i18n keys `themeLight` / `themeDark` / `themeSystem` in both `Strings` tables
(RU: «Светлая» / «Тёмная» / «Системная»).

## Components / files touched

- `index.html` — inline head theme script; `theme-color` meta kept and updated.
- `src/index.css` — `@theme` semantic tokens, `.light` overrides, `color-scheme`
  per theme, `@custom-variant dark`; change `html { @apply bg-canvas }`; drop the
  static `:root { color-scheme: dark }`.
- `src/theme.ts` (new) — provider, hook, `resolveTheme`/`nextTheme`.
- `src/theme.test.ts` (new) — Vitest unit tests for resolve + cycle.
- `src/main.tsx` — wrap `<App/>` in `ThemeProvider`.
- `src/i18n.ts` — 3 theme strings × 2 languages.
- `src/App.tsx` — add `ThemeToggle`; migrate its neutral utilities to tokens.
- `src/components/*.tsx` — migrate neutral utilities to tokens; spot-fix
  accent-on-tint contrast with `dark:` where needed.
- `CLAUDE.md` — document the semantic-token convention + theme system.

## Testing & verification

- **Unit (Vitest):** `resolveTheme` and `nextTheme` in `src/theme.test.ts`.
- **Gate:** `npm run build` (strict type-check) + `npm run test:run` green.
- **Visual:** run the app and check both themes on a mobile viewport — setup
  screen, scoreboard, score modal, menus/modals, the message toast — and confirm
  no white flash on refresh in dark mode. (No DOM/component test setup exists, so
  appearance is verified by running the app, per project convention.)
- **Audit:** grep components for leftover `text-white` / `bg-gray-*` /
  `bg-white/*` / `border-white/*` — any hit is a missed migration.

## Out of scope (YAGNI)

- Per-element accent re-theming beyond the few low-contrast fixes.
- A settings page or expanded preferences UI — the single cycling button is the
  whole surface.
- Theming the QR scanner camera overlay chrome beyond background/scrim.
