# 🏰 Carcassonne Companion

A mobile-first web app for keeping score in the board game
**Carcassonne**. Add your players, give each one a color, and track points as
you play — with quick-add helpers that do the Carcassonne math for you.

## Features

- **Bilingual (English / Russian)** — switch language any time from the header.
  Russian uses the official Carcassonne rule terms (Дорога, Город, Монастырь,
  Луг, герб, тайл) rather than literal translations, with correct Russian
  pluralization. The whole UI — including past score-log entries — re-localizes
  live, and your choice is remembered.
- **Feature emojis** — each game feature has an icon: 🛣️ Road, 🏰 City,
  ⛪ Cloister, 🌾 Field (and ✏️ for manual adjustments), shown on the scoring
  buttons and throughout the score log.
- **Players & colors** — add any number of players. Pick from the standard
  Carcassonne meeple colors (red, blue, yellow, green, black, plus the pink and
  gray expansion colors) or choose any **custom color** with the color picker.
- **Two ways to score**
  - **Running tally** — `+`/`−` buttons on each player and a manual entry pad
    (with quick amounts) for any house rules.
  - **Carcassonne presets** — pick a feature and the app computes the points:
    - **Road** — 1 per tile
    - **City** — 2 per tile + 2 per pennant when completed; 1 each at game end
    - **Cloister** — 1 + 1 per surrounding tile (9 when complete)
    - **Field** — 3 per completed city it borders (game end)
- **Expansion scoring**
  - **Inns & Cathedrals** — 🍺 **Inn** on a road (completed = 2/tile, incomplete
    = 0) and ✝️ **Cathedral** in a city (completed = 3/tile + 3/pennant,
    incomplete = 0), as toggles on the road/city forms.
  - **Traders & Builders** — 🍷🌽🧵 **trade goods** tracked per player (recorded
    on the Goods tab); "Score trade goods" in the menu awards 10 points to each
    majority at game end (ties shared). 🐷 **Pig** toggle on fields (4 per city).
  - **Bridges, Castles & Bazaars** — 🏯 **Castle** feature that scores the value
    of the completed feature that triggered it.
- **Live scoreboard** — players are ranked by score, with a 👑 on the leader.
- **Score log** — every change is recorded with who/what/how many, and any
  entry can be **undone** (which corrects the score).
- **Auto-save** — the current game is saved to your browser's `localStorage`,
  so a refresh or accidental close won't lose your scores.
- **Game menu** — edit players mid-game, reset scores, or start a new game.

## Getting started

```bash
npm install      # install dependencies
npm run dev      # start the dev server (http://localhost:5173)
npm run build    # type-check and build for production into dist/
npm run preview  # preview the production build
```

## Deployment (GitHub Pages)

The app deploys automatically to GitHub Pages via the workflow in
[`.github/workflows/deploy.yml`](.github/workflows/deploy.yml). On every push to
the deploy branch it builds the site and publishes `dist/`.

Once published it is served at:

**https://nikigan.github.io/carcassonne-companion/**

One-time setup in the repository: **Settings → Pages → Build and deployment →
Source: GitHub Actions**. The site's base path is configured as
`/carcassonne-companion/` in [`vite.config.ts`](vite.config.ts).

## Tech stack

- [React 19](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/)
- [Vite](https://vite.dev/) for the build/dev server
- [Tailwind CSS v4](https://tailwindcss.com/) for styling

## How scoring works

Most points are best entered the moment a feature is completed during play.
Open a player's **Score** dialog, choose the **Features** tab, pick the feature
type and fill in the tile/pennant counts — the dialog shows the computed total
before you confirm. Fields and incomplete cities/roads are typically scored at
the **end of the game**; toggle "Completed" off on cities to score them at the
end-game rate. For anything unusual, the **Manual** tab adds or subtracts a raw
amount.

All state lives entirely in the browser — there is no backend and no account.
