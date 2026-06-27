# Simplify city scoring form when Mage & Witch is disabled

## Goal
In `ScoreModal`'s City form, when the **Mage & Witch** expansion is disabled,
unite the separate "Tiles" and "Coat of arms" inputs into one combined count.
Counting them distinctly only matters for the mage (+1 per *tile*, pennants
excluded); otherwise both score identically, so two fields are needless.

## Why it's safe
`scoreCity(tiles, pennants, …)` uses `tiles + pennants` (both worth the same).
The only tile-vs-pennant distinction is `applyMagic` (mage bonus). With
Mage & Witch off, `magic` is always `'none'`, so storing the combined count in
`tiles` with `pennants: 0` yields the identical score and a clean log label
("City completed (N tiles)").

## Changes
- [x] `src/i18n.ts`: add `tilesAndPennants` string (en + ru) to `Strings`.
- [x] `src/components/ScoreModal.tsx`: `CityForm` renders one combined field
      when `!mageWitch`, the two separate fields when `mageWitch`.
- [x] `npm run build` clean
- [x] `npm run test:run` green (34 passed)

## Notes
- No scoring/types/storage changes — descriptor shape is unchanged.
- Label: EN "Tiles + coats of arms", RU "Тайлы + щиты".
