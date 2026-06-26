# Tablet two-column layout + PWA bottom fill

## Goal
1. Use bigger screens better: two columns on tablets+ (≥768px / `md`) —
   players on the left (sticky), score log on the right (scrolls past).
2. PWA on iPhone shows a black band below the content when the score log is
   short: the dark surface (`bg-gray-900`) doesn't fill the viewport because
   `min-height: 100%` under-fills in iOS standalone. Make the app reach the
   very bottom edge.

## Decisions (confirmed with user)
- Column behavior: **players fixed (sticky), log scrolls** (page scroll +
  `position: sticky` on the players column).
- Breakpoint: **`md` (≥768px)** — iPad portrait and up; phones unchanged.
- Task 2 black band only shows when the list is short → a fill/height issue,
  not the home-indicator safe area.

## Plan
- `index.css`: paint the page canvas dark (`html { @apply bg-gray-900 }`) so any
  uncovered area / overscroll matches the app instead of showing black.
- `App.tsx`:
  - root `min-h-full` → `min-h-dvh` (fills the full dynamic viewport in
    standalone even with short content).
  - measure the sticky header height via `ResizeObserver`, expose it as the CSS
    var `--app-header-h` on the root so the sticky players column can offset by
    exactly the header height.
  - header inner container `max-w-md` → also `md:max-w-5xl` so it aligns with
    the widened content.
- `Scoreboard.tsx`:
  - wrapper → `md:max-w-5xl md:grid md:grid-cols-2 md:items-start md:gap-6`.
  - players column → `md:sticky md:top-[calc(var(--app-header-h,4.5rem)_+_1rem)]`.
  - log column → `md:mt-0` (drop the mobile `mt-8` gap at `md`).

## Status
- [x] Design confirmed with user
- [x] index.css — dark canvas (`html { @apply bg-gray-900 }`)
- [x] App.tsx — min-h-dvh + header measurement (`--app-header-h`) + `md:max-w-5xl` header
- [x] Scoreboard.tsx — two-column grid + sticky players
- [x] `npm run build` green; compiled CSS verified (dvh, calc sticky offset,
      `html` bg = `--color-gray-900`)
- [x] Visual check: two columns + sticky players confirmed in-browser at wide
      viewport; log scrolls while players stay pinned. (Could not force a literal
      768px OS window; layout math at the breakpoint is sound — ~356px columns.)

## Notes
- PWA black-band fix verified by compiled CSS only; the iOS-standalone symptom
  needs an on-device check (install PWA, short log → no black band at bottom).
- Changes are uncommitted, ready to commit when the user asks.

## Out of scope
- PlayerSetup (pre-game) stays centered/single-column.
