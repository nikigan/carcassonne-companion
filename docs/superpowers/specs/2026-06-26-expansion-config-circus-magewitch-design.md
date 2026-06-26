# Expansion configuration + Circus & Artists + Mage & Witch

Date: 2026-06-26

## Goal

Add scoring support for two more Carcassonne expansions and a mechanism for
players to choose which expansions are in play, so the scoring UI only shows
entities for the expansions actually being used.

1. **The Mage & The Witch** (official mini-expansion #5).
2. **Circus & Artists** = "Under the Big Top" (official Expansion 10). Three
   scoring systems in one box: Circus/Big Top, Acrobats, Ringmaster. There is no
   separate "Artists" expansion — the "artists" are the circus acrobats.
3. **Expansion configuration**: a per-game set of toggles, editable before the
   game starts (in player setup) and during the game (from the menu). Lists all
   implemented expansions. Gates which scoring entities appear in the UI.

## Verified rules (source of truth)

Cross-checked against the official Z-Man (English) and Hans im Glück (German)
rulebooks. Do not "simplify" these.

### Mage & Witch — roads and cities only

- The Mage and Witch may only sit on an **incomplete road or city**. They never
  affect monasteries or fields. They are mutually exclusive on a single feature.
- They affect scoring both when the feature is **completed in play** and at
  **final scoring** for features still incomplete at game end.
- **Mage:** `+1 point per tile` in the scored feature, on top of the normal
  score. Flat per-tile — pennants do **not** get the bonus. Example: completed
  8-tile city + 2 pennants normally 20 → with mage `20 + 8 = 28`.
- **Witch:** halves the feature's **final** points, **rounded up** (in the
  player's favour) → `Math.ceil(points / 2)`. Example: 5-tile road worth 5 →
  with witch `ceil(5/2) = 3`.

### Circus & Artists — three systems

- **Circus / Big Top:** when a circus scores, every player scores, per their own
  meeple on the Big Top's tile and its 8 neighbours, points equal to the
  revealed animal token's value. Animal values: Elephant 7, Tiger 6, Bear 5,
  Seal 4, Monkey 3, Flea 1 (no animal is worth 2). Per player:
  `animalValue × meeples`.
- **Acrobat pyramid:** each acrobat scores its owner **5 points**. A completed
  pyramid (3 acrobats) is scored on a later turn; at game end every acrobat
  scores 5 regardless of pyramid size. Per player: `acrobats × 5`.
- **Ringmaster:** when the feature holding the Ringmaster scores, add **+2 for
  each circus or acrobat tile** on or adjacent to the Ringmaster's tile (its own
  tile + up to 8 neighbours). Earned even if the feature itself paid the
  Ringmaster's owner 0 points. Applies to incomplete features / fields at game
  end too. Per player: `tiles × 2`.

## Decisions

- **New-game default:** *remember last game.* `newGame()` carries the current
  expansion selection forward. The very first game (no prior save) defaults to
  **base game only** (all expansion flags off).
- **Existing saves:** migrate to **all expansions on**, preserving today's full
  UI for an in-progress game.
- **Circus input:** an animal picker (🐘7 🐅6 🐻5 🦭4 🐒3 🦟1) × the player's
  meeple count.
- **Ringmaster:** a standalone scoring button (enter # adjacent circus/acrobat
  tiles → ×2). The underlying road/city/field is scored normally and separately.
- **Mage/Witch:** a 3-way segmented control (None · Mage · Witch) inside the
  existing Road and City forms, gated by the Mage & Witch toggle.
- **Expansion picker:** base game is **not** shown (always in play). Only the 7
  toggleable expansions are listed.

## Data model

### `expansions.ts` (new — single source of truth for the registry)

```ts
export type ExpansionId =
  | 'innsCathedrals' | 'tradersBuilders' | 'bridgesCastlesBazaars'
  | 'goldMines' | 'messages' | 'mageWitch' | 'circus'

export interface ExpansionMeta { id: ExpansionId; emoji: string }
export const EXPANSIONS: ExpansionMeta[] // ordered list driving the picker

export type ExpansionConfig = Record<ExpansionId, boolean>
export const ALL_ON: ExpansionConfig    // every flag true
export const BASE_ONLY: ExpansionConfig // every flag false
```

Adding a future expansion = one entry in `EXPANSIONS` + its gating + i18n.

### `types.ts`

```ts
export type MagicFigure = 'none' | 'mage' | 'witch'
export type CircusAnimal = 'elephant' | 'tiger' | 'bear' | 'seal' | 'monkey' | 'flea'
```

`ScoreDescriptor`:
- `road` and `city` gain `magic: MagicFigure`.
- add `{ kind: 'circus'; animal: CircusAnimal; meeples: number }`
- add `{ kind: 'acrobats'; count: number }`
- add `{ kind: 'ringmaster'; tiles: number }`

`GameState` gains `expansions: ExpansionConfig`.

### `storage.ts`

- `emptyGame.expansions = BASE_ONLY`.
- `loadGame`: if a parsed save has no `expansions`, set `ALL_ON`.
- `migrateEntry`: backfill `magic: 'none'` on old `road`/`city` descriptors.

## Scoring (`scoring.ts`)

```ts
export const ANIMAL_VALUE: Record<CircusAnimal, number> =
  { elephant: 7, tiger: 6, bear: 5, seal: 4, monkey: 3, flea: 1 }
export const ANIMAL_EMOJI: Record<CircusAnimal, string> =
  { elephant: '🐘', tiger: '🐅', bear: '🐻', seal: '🦭', monkey: '🐒', flea: '🦟' }
export const ACROBAT_POINTS = 5
export const RINGMASTER_PER_TILE = 2
export const MAGE_EMOJI = '🧙', WITCH_EMOJI = '🧹'
export const CIRCUS_EMOJI = '🎪', ACROBAT_EMOJI = '🤸', RINGMASTER_EMOJI = '🎩'

export function applyMagic(base: number, tiles: number, magic: MagicFigure): number
// mage → base + tiles ; witch → ceil(base/2) ; none → base
export function scoreCircus(animal, meeples): number   // ANIMAL_VALUE[animal] * meeples
export function scoreAcrobats(count): number           // count * 5
export function scoreRingmaster(tiles): number         // tiles * 2
```

`FeatureType` extends with `circus | acrobats | ringmaster`; `FEATURE_EMOJI`
gains those. Road/City forms compute
`applyMagic(scoreRoad/​scoreCity(...), tiles, magic)` — note `tiles` (not
`tiles + pennants`) for the mage.

## UI

### `ExpansionPicker.tsx` (new)

A list of toggle rows: `{emoji} {localized name}` + one-line description +
`Toggle`. Props: `config: ExpansionConfig`, `onToggle(id, on)`. No base-game row.
Reused in:
- **PlayerSetup** — an "Expansions" section above the Start button.
- **App menu** — a new "Expansions" item opens the picker in a bottom-sheet
  modal (same overlay style as `ScoreModal`).

### Gating (everything reads `config`)

| Entity | Gated by |
|---|---|
| Road inn toggle / City cathedral toggle | innsCathedrals |
| Field pig toggle | tradersBuilders |
| Field +castle input | bridgesCastlesBazaars |
| Goods tab (whole tab) | tradersBuilders \|\| goldMines |
| Goods: wine/grain/cloth | tradersBuilders |
| Goods: gold | goldMines |
| Menu: "Score trade goods" | tradersBuilders |
| Menu: "Score gold" | goldMines |
| Feature button: castle | bridgesCastlesBazaars |
| Feature button: message | messages |
| Feature buttons: circus / acrobats / ringmaster | circus |
| Road & City Mage/Witch control | mageWitch |

### New `ScoreModal` forms

- **CircusForm:** animal picker (6 emoji buttons) + meeple count → `scoreCircus`.
- **AcrobatsForm:** count → `scoreAcrobats`.
- **RingmasterForm:** adjacent circus/acrobat tile count → `scoreRingmaster`.

`useGame` exposes `setExpansion(id, on)`. `newGame` carries `expansions` forward.

## i18n (`i18n.ts`)

New en + ru keys: expansion names + descriptions, "Expansions" titles/menu
label, Mage/Witch/magic-figure labels, Circus/Acrobats/Ringmaster feature names
+ hints, animal names. `formatDescriptor` gains cases for the 3 new kinds and a
magic suffix (🧙/🧹) on road & city. Russian official terms: Маг, Ведьма, Цирк,
Директор цирка (ringmaster), Акробаты (acrobats), and the existing expansion
names (Трактиры и соборы, Купцы и строители, Мосты, замки и базары, Золотые
жилы, Послания).

## Files touched

`scoring.ts`, `types.ts`, `storage.ts`, `useGame.ts`, `i18n.ts`, `App.tsx`,
`PlayerSetup.tsx`, `Scoreboard.tsx`, `ScoreModal.tsx`; new `expansions.ts` and
`components/ExpansionPicker.tsx`.

## Verification

`npm run build` (tsc strict + vite) must stay green. Manual smoke: toggle each
expansion off and confirm its UI entities disappear from the modal/menu; score
a mage road, a witch city, a circus payout, acrobats, and a ringmaster bonus and
confirm the log entries localize correctly in both languages.
