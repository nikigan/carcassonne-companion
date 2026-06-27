# Move language & theme selectors into the header menu

## Goal
- Move the language toggle and theme toggle out of the always-visible header
  strip and into the header "Menu ▾" dropdown.
- Make the menu available on the start (PlayerSetup) screen too — there it shows
  **only** the language + theme selectors (no game actions yet).

## Changes
- `src/i18n.ts`: added `languageLabel` / `themeLabel` strings (en + ru:
  "Language"/"Язык", "Theme"/"Тема").
- `src/App.tsx`:
  - Removed the inline language pill and `<ThemeToggle />` from the header bar.
  - The `Menu ▾` button + dropdown now render **always** (previously gated on
    `state.started`). Game actions only render when `state.started`, followed by
    a divider; the appearance settings (`<MenuAppearance />`) always render.
  - Replaced the old cycling `ThemeToggle` component with `MenuAppearance`
    (language + theme rows) plus `SettingRow` / `SegButton` helpers.
  - Theme is now a 3-way segmented control (☀️/🌙/🖥️) via `setTheme`, not a
    cycle button — more discoverable in a menu.
  - Tapping a swatch leaves the menu open (the outside-click closer ignores
    in-menu clicks), so both can be flipped without reopening.
  - Dropdown widened `w-52` → `w-60` to fit the segmented controls.

## Status: done — build + tests green, verified in browser
- `npm run build` clean (tsc strict + vite).
- `npm run test:run` — 40/40 pass.
- Browser-verified (localhost:5173):
  - Start screen: `Menu ▾` present; dropdown shows only Language + Theme.
  - Switching RU re-localizes the whole UI; switching Light reskins the app;
    active swatch highlights; menu stays open across taps.
  - In-game menu: game actions → divider → Language + Theme rows.
