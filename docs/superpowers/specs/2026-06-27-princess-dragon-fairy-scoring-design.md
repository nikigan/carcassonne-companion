# The Princess & the Dragon — Fairy scoring

**Date:** 2026-06-27
**Status:** Approved, ready for implementation plan

## Summary

Add scoring support for Carcassonne expansion 3, *The Princess & the Dragon*.
In a companion scoring app the **Fairy** is the only element that produces
points, so "scoring support" for this expansion means the Fairy and nothing
else. It is added as a standalone feature form gated behind a new
`princessDragon` expansion toggle, following the exact pattern every prior
expansion uses.

## Scope

### In scope — the Fairy

Two scoring events ([Z-Man new edition][zman] / [Hobby World "Принцесса и
дракон"][hw]):

- **+1** at the start of a player's turn, if the fairy shares a tile with one
  of that player's followers.
- **+3** bonus when a feature is scored where a follower shares its tile with
  the fairy (in addition to the feature's own points).

### Out of scope — everything else in the box

The Dragon (eats / returns meeples), the Princess (removes a knight from a
city), the Magic Portal (deploy a follower anywhere) and the Volcano (places
the dragon) all change *where meeples go*, not point values. This app holds no
board state, so there is nothing for it to score or track for these. They are
deliberately excluded.

## Design decision

The +1 (recurring, per turn) and +3 (feature completion bonus) are modeled as a
**single standalone `Fairy` feature** in the Features grid with two one-tap
buttons, rather than folding the +3 into a toggle on each scorable feature.

Rationale:
- The +1 is inherently standalone (it is not tied to scoring a feature), so a
  dedicated control is needed regardless. Keeping both fairy events in one form
  is the most coherent shape.
- Isolation: it touches no existing scoring function or descriptor. Folding the
  +3 into road/city/monastery/field would mean changing four scoring functions
  and their descriptors, plus interactions with inn / cathedral / mage / witch.
- The log stays legible: completing a city with the fairy reads as two lines
  (`🏰 City completed … +8`, then `🧚 Fairy +3 … +3`), making the bonus
  explicit.

Trade-off accepted: scoring a feature with the fairy is two taps / two log
lines instead of one combined entry.

## Touch points

Mirrors how Circus & Artists and Mage & Witch were added.

### 1. `src/expansions.ts`
- Add `'princessDragon'` to the `ExpansionId` union.
- Add an `EXPANSIONS` entry `{ id: 'princessDragon', emoji: '🐉' }`, inserted
  after `tradersBuilders` (official expansion-3 ordering).
- `buildConfig`, `ALL_ON`, `BASE_ONLY` and `normalizeConfig` pick the new key up
  automatically — no other change in this file.

### 2. `src/types.ts`
- Add one `ScoreDescriptor` variant: `{ kind: 'fairy'; bonus: 1 | 3 }`.

### 3. `src/scoring.ts`
- Add `'fairy'` to the `FeatureType` union and to `FEATURE_EMOJI` (`🧚`).
- Add constants `FAIRY_EMOJI = '🧚'`, `FAIRY_TURN_BONUS = 1`,
  `FAIRY_FEATURE_BONUS = 3` so the point values live with the scoring rules.
- No new math function: the bonus *is* the value (the form passes the literal),
  consistent with existing fixed-value constants like `ACROBAT_POINTS`.

### 4. `src/i18n.ts`
Add to both `en` and `ru` (TypeScript enforces completeness):
- `featureNames.fairy`: **Fairy** / **Фея**
- `expansionNames.princessDragon`: **The Princess & the Dragon** /
  **Принцесса и дракон**
- `expansionDescriptions.princessDragon`:
  **The fairy: +1 each turn, +3 when a feature scores.** /
  **Фея: +1 за ход, +3 при подсчёте объекта.**
- Form strings:
  - `fairyTurnBonus`: **Start of turn** / **В начале хода**
  - `fairyFeatureBonus`: **Feature bonus** / **Бонус за объект**
  - `fairyHint`: **+1 when the fairy starts your turn beside your meeple; +3
    when a feature scores with the fairy.** / **+1, если в начале хода фея рядом
    с вашим миплом; +3 при подсчёте объекта с феей.**
- `formatDescriptor` cases (EN + RU) for `kind: 'fairy'`, distinguishing by the
  bonus value:
  - EN: `🧚 Fairy +1 (start of turn)` / `🧚 Fairy +3 (feature)`
  - RU: `🧚 Фея +1 (начало хода)` / `🧚 Фея +3 (объект)`

Russian uses the official Hobby World term **Фея**, matching the existing
"новое издание" vocabulary already in the file (поле, щит, тайл).

### 5. `src/components/ScoreModal.tsx`
- Gate `'fairy'` into the `features` list via
  `...(expansions.princessDragon ? (['fairy'] as const) : [])`.
- Render `{active === 'fairy' && <FairyForm onApply={onApply} />}`.
- New `FairyForm` component: two large buttons (+1 / +3) that call
  `onApply(bonus, { kind: 'fairy', bonus })` **immediately** on tap — no
  `NumberField` / `ApplyBar`, because both values are fixed. Labels come from
  `t.fairyTurnBonus` / `t.fairyFeatureBonus`; `t.fairyHint` below.

### 6. Migration — none required
- New games default the expansion **off** (`emptyGame` uses `BASE_ONLY`).
- Existing saves default it **on** via the `ALL_ON` fallback in
  `loadGame` → `normalizeConfig(parsed.expansions, ALL_ON)` — identical to how
  every previously-added expansion behaves for old saves.
- The `fairy` descriptor is purely additive; old log entries are unaffected.
- `Scoreboard`'s `FEATURE_DESC_KINDS` set (`road, city, cloister, field,
  castle`) already excludes `fairy`, so fairy entries never appear as a
  castle-value borrow option. No change needed.

### 7. `CLAUDE.md`
- Add a Princess & Dragon line to the "Implemented expansion scoring" list.

## Verification

- `npm run build` (tsc strict + vite) stays green — the gate.
- Manual: enable Princess & the Dragon in the expansion picker → a 🧚 Fairy
  feature appears → tapping +1 / +3 logs the right amount with a localized
  label that re-localizes when the language toggles.

[zman]: https://www.zmangames.com/game/carcassonne-the-princess-the-dragon/
[hw]: https://hobbygames.ru/karkasson-princessa-i-drakon/rules
