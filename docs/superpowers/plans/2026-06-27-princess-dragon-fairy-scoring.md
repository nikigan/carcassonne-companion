# Princess & Dragon (Fairy) Scoring Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add scoring for *The Princess & the Dragon* — the Fairy's two bonuses (+1 at start of turn, +3 when a feature scores) — as a standalone feature form behind a new `princessDragon` expansion toggle.

**Architecture:** Follow the exact pattern every prior expansion uses: register the expansion in `expansions.ts`, add a `ScoreDescriptor` variant + scoring constants, add localized strings + a `formatDescriptor` case, and render a gated form in `ScoreModal.tsx`. State flows through the existing generic `addScore(playerId, amount, desc)` → reducer path; no reducer or `useGame` change is required (a non-`manual` descriptor takes the generic log-entry branch at `reducer.ts:88-96`).

**Tech Stack:** React 19 + TypeScript (strict) + Vite 6 + Tailwind CSS v4.

## Global Constraints

- **Build is the only gate** — there is no test runner or linter. Every task ends with `npm run build` (runs `tsc -b` strict + `vite build`) passing clean. TypeScript exhaustiveness (`Record<FeatureType, …>`, `Record<ExpansionId, …>`, the typed `formatDescriptor` switch) is what enforces completeness — a missing case is a compile error.
- **Everything user-facing is localized** — every new string is added to BOTH `en` and `ru` in `src/i18n.ts`. TypeScript enforces this via the `Strings` interface.
- **Russian uses official Hobby World terms** — the Fairy is **Фея** (matching the existing "новое издание" vocabulary: поле, щит, тайл).
- **Scoring is data, not strings** — log entries store the structured `{ kind: 'fairy'; bonus }` descriptor; the label is produced by `formatDescriptor` at render time. Never store a pre-rendered string.
- **No self-attribution in commits** — clean one-line subjects, no trailers (matches this repo's history and the user's global instruction).
- **Track progress** — maintain `.claude/princess-dragon-fairy-scoring/PROGRESS.md`, updating it before each commit.

---

### Task 1: Register the expansion in the picker

Adds the `princessDragon` expansion id + its picker entry and localized name/description. After this task the expansion toggle appears in the picker (toggling it does nothing visible yet — that's Tasks 2–3).

**Files:**
- Create: `.claude/princess-dragon-fairy-scoring/PROGRESS.md`
- Modify: `src/expansions.ts` (the `ExpansionId` union + the `EXPANSIONS` array)
- Modify: `src/i18n.ts` (`expansionNames` and `expansionDescriptions` in both `en` and `ru`)

**Interfaces:**
- Produces: a new `ExpansionId` member `'princessDragon'`; `EXPANSIONS` gains `{ id: 'princessDragon', emoji: '🐉' }`. `ExpansionConfig` (a `Record<ExpansionId, boolean>`) automatically gains the key via `buildConfig`/`normalizeConfig`.

- [ ] **Step 1: Create the progress file**

Create `.claude/princess-dragon-fairy-scoring/PROGRESS.md`:

```markdown
# Princess & Dragon (Fairy) scoring — progress

Spec: docs/superpowers/specs/2026-06-27-princess-dragon-fairy-scoring-design.md
Plan: docs/superpowers/plans/2026-06-27-princess-dragon-fairy-scoring.md

## Status
- [ ] Task 1 — register expansion in picker
- [ ] Task 2 — fairy data model + log label
- [ ] Task 3 — fairy form + docs

## Notes
(none yet)
```

- [ ] **Step 2: Add `'princessDragon'` to the `ExpansionId` union**

In `src/expansions.ts`, change the union (insert after `'tradersBuilders'`, matching official expansion-3 ordering):

```ts
export type ExpansionId =
  | 'innsCathedrals'
  | 'tradersBuilders'
  | 'princessDragon'
  | 'bridgesCastlesBazaars'
  | 'goldMines'
  | 'messages'
  | 'mageWitch'
  | 'circus'
```

- [ ] **Step 3: Add the `EXPANSIONS` picker entry**

In `src/expansions.ts`, insert the entry after `tradersBuilders`:

```ts
export const EXPANSIONS: ExpansionMeta[] = [
  { id: 'innsCathedrals', emoji: '🍺' },
  { id: 'tradersBuilders', emoji: '🐷' },
  { id: 'princessDragon', emoji: '🐉' },
  { id: 'bridgesCastlesBazaars', emoji: '🏯' },
  { id: 'goldMines', emoji: '🟨' },
  { id: 'messages', emoji: '📜' },
  { id: 'mageWitch', emoji: '🧙' },
  { id: 'circus', emoji: '🎪' },
]
```

- [ ] **Step 4: Add the English expansion name + description**

In `src/i18n.ts`, in the `en` table's `expansionNames`, add after the `tradersBuilders` line:

```ts
    princessDragon: 'The Princess & the Dragon',
```

In the `en` table's `expansionDescriptions`, add after the `tradersBuilders` line:

```ts
    princessDragon: 'The fairy: +1 each turn, +3 when a feature scores.',
```

- [ ] **Step 5: Add the Russian expansion name + description**

In `src/i18n.ts`, in the `ru` table's `expansionNames`, add after the `tradersBuilders` line:

```ts
    princessDragon: 'Принцесса и дракон',
```

In the `ru` table's `expansionDescriptions`, add after the `tradersBuilders` line:

```ts
    princessDragon: 'Фея: +1 за ход, +3 при подсчёте объекта.',
```

- [ ] **Step 6: Build to verify green**

Run: `npm run build`
Expected: completes with no TypeScript errors. (If a `Record<ExpansionId, …>` is missing the new key, tsc fails here — add the missing entry.)

- [ ] **Step 7: Update progress and commit**

Tick Task 1 in `PROGRESS.md`, then:

```bash
git add src/expansions.ts src/i18n.ts .claude/princess-dragon-fairy-scoring/PROGRESS.md
git commit -m "Add Princess & Dragon to the expansion picker"
```

---

### Task 2: Fairy data model + localized log label

Adds the `fairy` `ScoreDescriptor` variant, its scoring constants, the feature emoji/name, and the `formatDescriptor` cases. After this task the model and label are type-complete; nothing is user-reachable yet (the form is Task 3).

**Files:**
- Modify: `src/types.ts` (the `ScoreDescriptor` union)
- Modify: `src/scoring.ts` (the `FeatureType` union, `FEATURE_EMOJI`, new bonus constants)
- Modify: `src/i18n.ts` (`featureNames` in both tables + the `formatEn`/`formatRu` switches)

**Interfaces:**
- Consumes: `FEATURE_EMOJI` (already exported from `src/scoring.ts`, already imported in `src/i18n.ts`).
- Produces:
  - `ScoreDescriptor` variant `{ kind: 'fairy'; bonus: 1 | 3 }`.
  - `FeatureType` member `'fairy'`; `FEATURE_EMOJI.fairy === '🧚'`.
  - Constants `FAIRY_TURN_BONUS: 1` and `FAIRY_FEATURE_BONUS: 3` exported from `src/scoring.ts`.

- [ ] **Step 1: Add the `fairy` descriptor variant**

In `src/types.ts`, add the variant to the `ScoreDescriptor` union, immediately after the `ringmaster` line:

```ts
  | { kind: 'ringmaster'; tiles: number }
  | { kind: 'fairy'; bonus: 1 | 3 }
  | { kind: 'goodsBonus'; good: GoodType }
```

- [ ] **Step 2: Add `'fairy'` to `FeatureType` and `FEATURE_EMOJI`**

In `src/scoring.ts`, add `'fairy'` to the `FeatureType` union (after `'ringmaster'`):

```ts
export type FeatureType =
  | 'road'
  | 'city'
  | 'cloister'
  | 'field'
  | 'castle'
  | 'gold'
  | 'message'
  | 'circus'
  | 'acrobats'
  | 'ringmaster'
  | 'fairy'
```

And add the emoji to `FEATURE_EMOJI` (after the `ringmaster` entry, before `manual`):

```ts
  ringmaster: '🎩',
  fairy: '🧚',
  manual: '✏️',
```

- [ ] **Step 3: Add the Fairy bonus constants**

In `src/scoring.ts`, append a new section at the end of the file (after the Circus & Artists block):

```ts
/* ------------------------------------------------------------------ *
 * The Princess & the Dragon (the Fairy)
 * ------------------------------------------------------------------ */

/** Fairy bonus at the start of your turn when it shares a follower's tile. */
export const FAIRY_TURN_BONUS = 1

/** Fairy bonus when a feature is scored with a follower on its tile. */
export const FAIRY_FEATURE_BONUS = 3
```

(No `scoreFairy` math function and no separate `FAIRY_EMOJI`: the bonus *is* the value, and `FEATURE_EMOJI.fairy` is the single source for the emoji — DRY, mirroring fixed-value constants like `ACROBAT_POINTS`.)

- [ ] **Step 4: Add the feature name in both languages**

In `src/i18n.ts`, in the `en` table's `featureNames`, add after `ringmaster`:

```ts
    ringmaster: 'Ringmaster',
    fairy: 'Fairy',
```

In the `ru` table's `featureNames`, add after `ringmaster`:

```ts
    ringmaster: 'Директор',
    fairy: 'Фея',
```

- [ ] **Step 5: Add the English log label**

In `src/i18n.ts`, in `formatEn`, add a case immediately before the `case 'goodsBonus':` line:

```ts
    case 'fairy':
      return d.bonus === 1
        ? `${FEATURE_EMOJI.fairy} Fairy +1 (start of turn)`
        : `${FEATURE_EMOJI.fairy} Fairy +3 (feature)`
```

- [ ] **Step 6: Add the Russian log label**

In `src/i18n.ts`, in `formatRu`, add a case immediately before the `case 'goodsBonus':` line:

```ts
    case 'fairy':
      return d.bonus === 1
        ? `${FEATURE_EMOJI.fairy} Фея +1 (начало хода)`
        : `${FEATURE_EMOJI.fairy} Фея +3 (объект)`
```

- [ ] **Step 7: Build to verify green**

Run: `npm run build`
Expected: no TypeScript errors. The typed `formatEn`/`formatRu` (`: string` return) force both fairy cases to exist; a `Record<FeatureType, …>` missing `fairy` also fails here. If either errors, the case/entry is missing — add it.

- [ ] **Step 8: Update progress and commit**

Tick Task 2 in `PROGRESS.md`, then:

```bash
git add src/types.ts src/scoring.ts src/i18n.ts .claude/princess-dragon-fairy-scoring/PROGRESS.md
git commit -m "Add fairy score descriptor, constants and log label"
```

---

### Task 3: Fairy form in the scoring modal + docs

Adds the gated `FairyForm` (two one-tap buttons) to `ScoreModal.tsx` and its form strings, then updates `CLAUDE.md`. After this task the feature is end-to-end functional.

**Files:**
- Modify: `src/i18n.ts` (the `Strings` interface + both tables: `fairyTurnBonus`, `fairyFeatureBonus`, `fairyHint`)
- Modify: `src/components/ScoreModal.tsx` (import the constants, gate `'fairy'` into the features list, render + define `FairyForm`)
- Modify: `CLAUDE.md` (the "Implemented expansion scoring" sentence)

**Interfaces:**
- Consumes: `FAIRY_TURN_BONUS` (`1`) and `FAIRY_FEATURE_BONUS` (`3`) from `src/scoring.ts`; the `{ kind: 'fairy'; bonus: 1 | 3 }` descriptor from `src/types.ts`; the `ApplyFn` type and `onApply` prop already defined in `ScoreModal.tsx` (`(amount: number, desc: ScoreDescriptor) => void`).

- [ ] **Step 1: Declare the form strings in the `Strings` interface**

In `src/i18n.ts`, in the `Strings` interface, add after the Circus & Artists block (after `animalNames: Record<CircusAnimal, string>`):

```ts
  // The Princess & the Dragon
  fairyTurnBonus: string
  fairyFeatureBonus: string
  fairyHint: string
```

- [ ] **Step 2: Add the English form strings**

In `src/i18n.ts`, in the `en` table, add after the `animalNames: { … },` block (i.e. right after the Circus & Artists strings):

```ts
  fairyTurnBonus: 'Start of turn',
  fairyFeatureBonus: 'Feature bonus',
  fairyHint:
    '+1 when the fairy starts your turn beside your meeple; +3 when a feature scores with the fairy.',
```

- [ ] **Step 3: Add the Russian form strings**

In `src/i18n.ts`, in the `ru` table, add after the `animalNames: { … },` block:

```ts
  fairyTurnBonus: 'В начале хода',
  fairyFeatureBonus: 'Бонус за объект',
  fairyHint:
    '+1, если в начале хода фея рядом с вашим миплом; +3 при подсчёте объекта с феей.',
```

- [ ] **Step 4: Import the Fairy constants in `ScoreModal.tsx`**

In `src/components/ScoreModal.tsx`, add the two constants to the existing import from `'../scoring'` (alphabetical order within the import block — place after `CATHEDRAL_EMOJI`):

```ts
  CATHEDRAL_EMOJI,
  FAIRY_FEATURE_BONUS,
  FAIRY_TURN_BONUS,
  FEATURE_EMOJI,
```

- [ ] **Step 5: Gate `'fairy'` into the features list**

In `src/components/ScoreModal.tsx`, inside `PresetForms`, add the gated entry to the `features` array, after the `messages` line and before the `circus` block:

```ts
  const features: FeatureType[] = [
    'road',
    'city',
    'cloister',
    'field',
    ...(expansions.bridgesCastlesBazaars ? (['castle'] as const) : []),
    ...(expansions.messages ? (['message'] as const) : []),
    ...(expansions.princessDragon ? (['fairy'] as const) : []),
    ...(expansions.circus
      ? (['circus', 'acrobats', 'ringmaster'] as const)
      : []),
  ]
```

- [ ] **Step 6: Render the form**

In `src/components/ScoreModal.tsx`, in `PresetForms`, add the render line after the `ringmaster` one:

```tsx
      {active === 'ringmaster' && <RingmasterForm onApply={onApply} />}
      {active === 'fairy' && <FairyForm onApply={onApply} />}
```

- [ ] **Step 7: Define `FairyForm`**

In `src/components/ScoreModal.tsx`, add this component after `RingmasterForm` (and before `GoodsForm`):

```tsx
function FairyForm({ onApply }: { onApply: ApplyFn }) {
  const { t } = useI18n()
  const bonuses: { bonus: 1 | 3; label: string }[] = [
    { bonus: FAIRY_TURN_BONUS, label: t.fairyTurnBonus },
    { bonus: FAIRY_FEATURE_BONUS, label: t.fairyFeatureBonus },
  ]
  return (
    <div>
      <div className="grid grid-cols-2 gap-2">
        {bonuses.map(({ bonus, label }) => (
          <button
            key={bonus}
            onClick={() => onApply(bonus, { kind: 'fairy', bonus })}
            className="flex flex-col items-center gap-1 rounded-xl bg-emerald-500 py-4 text-white transition hover:bg-emerald-400 active:scale-[0.98]"
          >
            <span className="text-2xl font-bold tabular-nums">+{bonus}</span>
            <span className="text-xs font-medium">{label}</span>
          </button>
        ))}
      </div>
      <p className="mt-3 text-xs text-white/40">{t.fairyHint}</p>
    </div>
  )
}
```

(`onApply` here is the modal's `apply` wrapper, which calls `onScore` then `onClose` — so a tap logs the bonus and closes the sheet, consistent with the other immediate-action forms.)

- [ ] **Step 8: Update `CLAUDE.md`**

In `CLAUDE.md`, find the "Implemented expansion scoring" paragraph and replace its final sentence so it ends with the newer expansions. Append after `The Messages (📜 manual point entry)`:

```
; The Mage & Witch (🧙 mage adds, 🧹 witch halves a road/city); Circus & Artists
(🎪 Big Top animals, 🤸 acrobats, 🎩 ringmaster); The Princess & the Dragon (🧚
fairy: +1 each turn, +3 when a feature scores).
```

(This also backfills the two previously-undocumented expansions adjacent to the edit, keeping the line accurate.)

- [ ] **Step 9: Build to verify green**

Run: `npm run build`
Expected: no TypeScript errors. (`{ kind: 'fairy', bonus }` must match the descriptor; `FAIRY_TURN_BONUS`/`FAIRY_FEATURE_BONUS` are the literal types `1`/`3`, assignable to `bonus: 1 | 3`.)

- [ ] **Step 10: Manual verification**

Run: `npm run dev`, open http://localhost:5173. Then:
1. Open the game menu → enable **The Princess & the Dragon** (🐉).
2. Start a game with a player → tap **Score** → the Features grid shows **🧚 Fairy**.
3. Select it → tap **+1 Start of turn** → the sheet closes and the log shows `🧚 Fairy +1 (start of turn) +1`; the player's score increases by 1.
4. Score again → **+3 Feature bonus** → log shows `🧚 Fairy +3 (feature) +3`.
5. Toggle the language to **RU** → the log entries re-localize to `🧚 Фея +1 (начало хода)` / `🧚 Фея +3 (объект)`.

- [ ] **Step 11: Update progress and commit**

Tick Task 3 in `PROGRESS.md`, then:

```bash
git add src/i18n.ts src/components/ScoreModal.tsx CLAUDE.md .claude/princess-dragon-fairy-scoring/PROGRESS.md
git commit -m "Add the fairy scoring form to the score sheet"
```

---

## Self-Review

**Spec coverage:**
- Register expansion (`expansions.ts` + i18n) → Task 1. ✓
- `fairy` descriptor (`types.ts`) → Task 2 Step 1. ✓
- `FeatureType` + `FEATURE_EMOJI` + bonus constants (`scoring.ts`) → Task 2 Steps 2–3. ✓
- `featureNames` + `formatDescriptor` en/ru → Task 2 Steps 4–6. ✓
- Form strings + `FairyForm` + gating (`ScoreModal.tsx`) → Task 3. ✓
- "No migration needed" → confirmed in spec; nothing to implement (new games off via `BASE_ONLY`, old saves on via `ALL_ON` fallback; `fairy` excluded from `Scoreboard`'s `FEATURE_DESC_KINDS` castle-borrow set). No task required. ✓
- `CLAUDE.md` line → Task 3 Step 8. ✓

**Placeholder scan:** No TBD/TODO/"handle edge cases"/"similar to" — every code step shows complete code. ✓

**Type consistency:** `FAIRY_TURN_BONUS`/`FAIRY_FEATURE_BONUS` (defined Task 2, consumed Task 3); descriptor `{ kind: 'fairy'; bonus: 1 | 3 }` consistent across `types.ts`, `formatDescriptor`, and `FairyForm`; `ApplyFn` reused from existing `ScoreModal.tsx`. ✓
