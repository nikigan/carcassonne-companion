# Expansion Config + Circus & Artists + Mage & Witch — Implementation Plan

> **For agentic workers:** Steps use checkbox (`- [ ]`) syntax. This repo has no
> test runner — `npm run build` (strict tsc + vite) is the verification gate.

**Goal:** Add scoring for Mage & Witch and Circus & Artists, plus a per-game
expansion-configuration mechanism (pre-game in setup + in-game from the menu)
that gates which scoring entities appear.

**Architecture:** A new `expansions.ts` registry is the single source of truth.
`GameState.expansions: ExpansionConfig` (a `Record<ExpansionId, boolean>`) flows
top-down from `useGame`; components read it to conditionally render. Scoring math
stays pure in `scoring.ts`; the score log stores structured `ScoreDescriptor`s
re-localized by `formatDescriptor`.

**Tech Stack:** React 19, TypeScript (strict), Vite 6, Tailwind v4.

## Global Constraints

- `npm run build` must stay green (strict type-check). Run it as the gate.
- Every user-facing string lives in the `Strings` interface with **both** `en`
  and `ru` values (TS enforces completeness). Russian uses official Hobby World
  terms: Маг, Ведьма, Цирк, Директор цирка, Акробаты.
- Scoring is data, not strings: log entries store `ScoreDescriptor`, labels via
  `formatDescriptor(desc, lang)`.
- Any new `Player`/`ScoreEntry`/`GameState` field needs a `storage.ts` migration.
- Base game is never shown in the picker (always in play).

---

### Task 1: Expansion registry (`expansions.ts`)

**Files:** Create `src/expansions.ts`.

- [ ] `ExpansionId` union: `innsCathedrals | tradersBuilders | bridgesCastlesBazaars | goldMines | messages | mageWitch | circus`.
- [ ] `ExpansionMeta { id; emoji }` and ordered `EXPANSIONS: ExpansionMeta[]`
      (emojis: 🍺, 🐷, 🏯, 🟨, 📜, 🧙, 🎪).
- [ ] `ExpansionConfig = Record<ExpansionId, boolean>`; `ALL_ON` (all true) and
      `BASE_ONLY` (all false) built from `EXPANSIONS` so they can't drift.

### Task 2: Types (`types.ts`)

**Files:** Modify `src/types.ts`. Consumes `ExpansionConfig` from Task 1.

- [ ] Add `MagicFigure = 'none' | 'mage' | 'witch'` and
      `CircusAnimal = 'elephant' | 'tiger' | 'bear' | 'seal' | 'monkey' | 'flea'`.
- [ ] Road & City descriptors gain `magic: MagicFigure`.
- [ ] Add descriptors: `{kind:'circus'; animal; meeples}`,
      `{kind:'acrobats'; count}`, `{kind:'ringmaster'; tiles}`.
- [ ] `GameState` gains `expansions: ExpansionConfig`.

### Task 3: Scoring math (`scoring.ts`)

**Files:** Modify `src/scoring.ts`. Consumes types from Task 2.

- [ ] Extend `FeatureType` with `circus | acrobats | ringmaster`; add their
      `FEATURE_EMOJI` (🎪, 🤸, 🎩).
- [ ] Add `MAGE_EMOJI`='🧙', `WITCH_EMOJI`='🧹'.
- [ ] `ANIMAL_VALUE` {elephant:7,tiger:6,bear:5,seal:4,monkey:3,flea:1} and
      `ANIMAL_EMOJI` {🐘,🐅,🐻,🦭,🐒,🦟}; `ACROBAT_POINTS`=5, `RINGMASTER_PER_TILE`=2.
- [ ] `applyMagic(base, tiles, magic)`: mage→`base+tiles`, witch→`Math.ceil(base/2)`, none→`base`.
- [ ] `scoreCircus(animal, meeples)`, `scoreAcrobats(count)`, `scoreRingmaster(tiles)`.

### Task 4: Storage migrations (`storage.ts`)

**Files:** Modify `src/storage.ts`. Consumes Tasks 1–2.

- [ ] `emptyGame.expansions = BASE_ONLY`.
- [ ] `loadGame`: `expansions: parsed.expansions ?? ALL_ON` (old saves → all on).
- [ ] `migrateEntry`: backfill `magic:'none'` on old `road`/`city` descriptors.

### Task 5: Game hook (`useGame.ts`)

**Files:** Modify `src/useGame.ts`. Consumes Tasks 1–4.

- [ ] Add `setExpansion(id: ExpansionId, on: boolean)` action.
- [ ] `newGame` carries `expansions` forward: `setState((s) => ({ ...emptyGame, expansions: s.expansions }))` (drop the now-redundant `clearGame()`; persistence effect rewrites storage).
- [ ] Return `setExpansion`.

### Task 6: i18n (`i18n.ts`)

**Files:** Modify `src/i18n.ts`. Consumes Tasks 1–3.

- [ ] `Strings` additions: `expansionsTitle`, `expansionsHint`, `expansionsMenu`,
      `expansionNames: Record<ExpansionId,string>`, `expansionDescriptions: Record<ExpansionId,string>`,
      `magicLabel`, `mage`, `witch`, `magicNone`, feature names for circus/acrobats/ringmaster,
      `circusHint`, `acrobatsHint`, `ringmasterHint`, `circusAnimal`, `meeples`,
      `acrobatsCount`, `ringmasterTiles`, `animalNames: Record<CircusAnimal,string>`.
- [ ] Provide both `en` and `ru`.
- [ ] `formatDescriptor`: magic suffix (🧙/🧹) on road & city; new cases for
      circus / acrobats / ringmaster in both languages.

### Task 7: ExpansionPicker (`components/ExpansionPicker.tsx`)

**Files:** Create `src/components/ExpansionPicker.tsx`. Consumes Tasks 1, 6.

- [ ] Props `{ config: ExpansionConfig; onToggle: (id, on) => void }`.
- [ ] Map `EXPANSIONS` → rows: emoji + `t.expansionNames[id]` + description + a
      reusable Toggle. No base-game row.

### Task 8: PlayerSetup (`components/PlayerSetup.tsx`)

**Files:** Modify `src/components/PlayerSetup.tsx`. Consumes Tasks 5, 7.

- [ ] Accept `expansions` + `onToggleExpansion` props; render an "Expansions"
      section (heading `t.expansionsTitle`) with `<ExpansionPicker>` above the
      Start bar.

### Task 9: App menu + Expansions modal (`App.tsx`)

**Files:** Modify `src/App.tsx`. Consumes Tasks 5, 7.

- [ ] Gate menu items: "Score trade goods" ↔ tradersBuilders, "Score gold" ↔
      goldMines. Add an always-present "Expansions" menu item.
- [ ] "Expansions" opens a bottom-sheet modal wrapping `<ExpansionPicker>`.
- [ ] Pass `expansions`/`onToggleExpansion` to `PlayerSetup`.

### Task 10: ScoreModal gating + new forms (`components/ScoreModal.tsx`)

**Files:** Modify `src/components/ScoreModal.tsx`. Consumes Tasks 2, 3, 6.

- [ ] Accept `expansions: ExpansionConfig` prop.
- [ ] Tabs: Goods tab only if `tradersBuilders || goldMines`.
- [ ] PresetForms feature list built from config (castle↔BCB, message↔Messages,
      circus/acrobats/ringmaster↔circus).
- [ ] Road inn / City cathedral gated by innsCathedrals; add Mage/Witch 3-way
      segmented control gated by mageWitch; compute `applyMagic(scoreRoad/​City(...), tiles, magic)`.
- [ ] Field pig ↔ tradersBuilders; Field castle input ↔ bridgesCastlesBazaars.
- [ ] GoodsForm: trade goods ↔ tradersBuilders, gold ↔ goldMines.
- [ ] New `CircusForm` (animal picker + meeples), `AcrobatsForm` (count),
      `RingmasterForm` (tiles).

### Task 11: Scoreboard wiring (`components/Scoreboard.tsx`)

**Files:** Modify `src/components/Scoreboard.tsx`. Consumes Task 10.

- [ ] Pass `expansions={state.expansions}` to `<ScoreModal>`.

### Task 12: Build + smoke

- [ ] `npm run build` green.
- [ ] Manual: toggle each expansion off → its entities vanish (modal tabs/feature
      buttons, menu items, road/city toggles). Score a mage road, witch city,
      circus, acrobats, ringmaster; flip EN/RU and confirm log labels localize.

## Self-Review

- **Spec coverage:** every spec section maps to a task (registry→T1, types→T2,
  scoring→T3, migrations→T4, hook→T5, i18n→T6, picker→T7, setup→T8, menu→T9,
  modal→T10, board→T11, verify→T12). No gaps.
- **Type consistency:** `ExpansionId`/`ExpansionConfig` (T1) used in T2/T4/T5/
  T7–T11; `MagicFigure`/`CircusAnimal` (T2) used in T3/T6/T10; scoring fns (T3)
  used in T10. Names consistent.
- **Placeholders:** none — each task lists concrete identifiers and values.
