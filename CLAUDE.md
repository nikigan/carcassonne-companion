# CLAUDE.md

Guidance for working in this repository.

## What this is

A mobile-first web **companion app for the board game Carcassonne** that tracks
each player's score. Pure client-side SPA — no backend, no accounts. The current
game persists to `localStorage`. Bilingual (English / Russian).

## Stack & commands

- **React 19 + TypeScript + Vite 6 + Tailwind CSS v4** (Tailwind via the
  `@tailwindcss/vite` plugin; styles live in `src/index.css` via
  `@import 'tailwindcss'`).

```bash
npm install      # install deps
npm run dev      # dev server (http://localhost:5173)
npm run build    # tsc -b && vite build  → ALWAYS run before committing
npm run preview  # serve the production build (http://localhost:4173)
```

There is no test runner or linter configured. **`npm run build` is the gate** —
it type-checks (strict) and builds. Keep it green.

## Architecture

State flows top-down from one hook; components are presentational.

- `src/useGame.ts` — **the single source of truth.** Owns `GameState`
  (players + score log + `started`), persists every change to `localStorage`,
  and exposes intent-named actions (`addPlayer`, `addScore`, `recordTokens`,
  `scoreTradeGoods`, `scoreGoldIngots`, `undoEntry`, `resetScores`, `newGame`,
  …). Components never mutate state directly — they call these.
- `src/App.tsx` — top-level layout + header (language toggle, game menu). Renders
  `PlayerSetup` before the game starts, `Scoreboard` after.
- `src/components/`
  - `PlayerSetup.tsx` — add/rename/remove players, pick colors, start.
  - `Scoreboard.tsx` — ranked player cards, the score log, and the token
    tallies. Sorting is **debounced 3s** after the last score change and cards
    reorder with a **FLIP animation** (see `RESORT_DELAY`, `prefersReducedMotion`).
  - `ScoreModal.tsx` — the scoring sheet: **Features / Goods / Manual** tabs.
  - `ColorPicker.tsx` — palette swatches + custom color input.
- `src/scoring.ts` — **pure** scoring math (no UI, no i18n). One function per
  feature returning a point number, plus emoji constants (`FEATURE_EMOJI`,
  `GOODS_EMOJI`, modifier emojis) and `goldRate`.
- `src/types.ts` — `Player`, `GameState`, `ScoreEntry`, the `ScoreDescriptor`
  union, `TradeGoods`/`TokenDelta`, `emptyGoods()`.
- `src/colors.ts` — meeple palette, `contrastText`, `nextAvailableColor`.
- `src/storage.ts` — `loadGame`/`saveGame`/`clearGame`, `uid()`, and
  **migrations** for older saves.
- `src/i18n.ts` — `LanguageProvider` + `useI18n`, the `Strings` tables (`en`,
  `ru`), pluralization helpers, and `formatDescriptor`.

## Key conventions

### Scoring is data, not strings
Score log entries store a **structured `ScoreDescriptor`** (e.g.
`{ kind: 'city', tiles, pennants, completed, cathedral }`), never a
pre-rendered string. The label is produced at render time by
`formatDescriptor(desc, lang)`. This is what lets the whole log re-localize live
when the language changes — preserve this pattern.

### Everything user-facing is localized
No hard-coded UI strings in components. Add a key to the `Strings` interface in
`src/i18n.ts` and provide **both** `en` and `ru` values (TypeScript enforces
completeness). Russian uses the **official Carcassonne rule terms**, not literal
translations (Дорога, Город, Монастырь, Поле, щит, тайл, Трактир, Собор, Свинья,
Замок, Золото, Послание) with correct 3-form pluralization (`pluralRu`). These
match the Hobby World 2019 "Новое издание" rulebook (поле, щит — not луг, герб),
**except** "тайл" is kept as the familiar community term for the rulebook's
"квадрат". English matches the Z-Man new edition (Monastery, coat of arms).

### Adding a feature / expansion scoring
1. `scoring.ts`: add a pure `scoreX(...)` returning points (+ any emoji).
2. `types.ts`: add a `ScoreDescriptor` variant `{ kind: 'x'; … }`.
3. `i18n.ts`: add strings + a `formatDescriptor` case for **both** languages.
4. `ScoreModal.tsx`: add the input form (immediate point sources go in the
   Features grid; collected-then-scored tokens go on the Goods tab + a menu
   action in `App.tsx`, like trade goods / gold).
5. If it adds a `Player`/`ScoreEntry` field, add a **migration** in
   `storage.ts` so old saves don't break.

### Implemented expansion scoring
Base game; Inns & Cathedrals (inn 🍺 on roads, cathedral ✝️ on cities);
Traders & Builders (trade goods majorities, pig 🐷); Bridges, Castles & Bazaars
(castle 🏯); Gold Mines (🟨 progressive: 1–3→1/ea, 4–6→2, 7–9→3, 10+→4 — scored
from the menu at game end via `goldRate`); The Messages (📜 manual point entry).

## Deployment

Deployed to **Cloudflare Workers (Static Assets)**. Live at
**https://carcassonne.gankin.xyz**.

- `wrangler.jsonc` configures an **assets-only** Worker: Cloudflare serves the
  built `dist/` directly (no server code yet). `not_found_handling:
  single-page-application` makes unmatched routes serve `index.html` (SPA deep
  links). The custom domain is attached via `routes` + `custom_domain: true`,
  which auto-provisions DNS + TLS on the `gankin.xyz` zone.
- Served from the **domain root**, so `vite.config.ts` sets `base: '/'`.
  Reference public assets with root-relative paths.
- **CI/CD:** **Cloudflare Workers Builds** (git-connected) auto-builds + deploys
  on push to `main` (build `npm run build`, deploy `npx wrangler deploy`). Manual
  deploys: `npm run deploy` (runs the build, then `wrangler deploy`).

**Future server (multiplayer):** add a `main` entry + bindings (e.g. Durable
Objects, WebSockets) to the same `wrangler.jsonc` / Worker — no re-platforming.
Architecture, code sketches, and a phased rollout live in
[`docs/multiplayer.md`](docs/multiplayer.md).

## Git

Commit only when work is verified (`npm run build` clean). End commit messages
with the project's `Co-Authored-By` / `Claude-Session` trailers. Do not create
PRs unless asked.
