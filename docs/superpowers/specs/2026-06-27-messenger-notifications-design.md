# The Messengers — message notifications

**Date:** 2026-06-27
**Status:** Design / approved for planning

## Goal

When playing with the Messengers expansion, the app should **tell you the moment a
player has earned a message tile**, so nobody has to track the two scoring figures
on the board by hand. The tile itself is still resolved manually (the existing 📜
Messages scoring form already records the resulting points).

## Background: the real rule (current Z-Man / Hobby World edition)

The expansion — **The Messengers** (Russian: **Гонцы**) — gives each player a
second figure, the **messenger** (Russian: **гонец**), next to their normal scoring
meeple. Both sit on the score track. When you score, you advance **one** of your two
figures. **Only the active player draws a message tile (Russian: послание), and only
when one of their figures *lands exactly on* a dark space** — a multiple of 5
(5, 10, 15, …). Passing a dark space does not count; landing does. One landing draws
one tile, which gives points or an action (score a feature, points per
pennant/knight/farmer, an extra tile, …).

Sources: [wikicarpedia – The Messages](https://wikicarpedia.com/car/The_Messages_(1st_edition)),
[boardgaming.com – The Messengers (2nd ed.)](https://boardgaming.com/games/board-games/carcassonne-mini-expansion-2-the-messengers-second-edition).

## The strategy question — and why it collapses to one check

The user's house rule is: **route ÷5 scores to the messenger, everything else to the
meeple.** This was checked against alternatives and is **optimal among real-time
strategies**: it pins the messenger permanently onto the multiples-of-5 lane, so every
÷5 score is a *guaranteed* message (the high-value catches), and the meeple has no
better move without knowing future scores.

Because the messenger is always on a multiple of 5, the meeple's subtotal is congruent
to the player's **running total** mod 5. So the meeple lands on a multiple of 5 exactly
when the total does. The entire trigger therefore reduces to a single per-score check —
no two-marker bookkeeping required:

> **A player earns a message when the points just entered are a multiple of 5,
> OR their new running total is a multiple of 5** (and the points are > 0).

Each scoring event moves exactly one figure, so this yields **at most one message per
event**, matching "lands on" (never double-counting a passed dark space).

## Trigger engine — `useMessageAlerts`

A new, isolated hook `src/useMessageAlerts.ts` owns all alert state. It is **ephemeral
UI state**, not part of `GameState`/localStorage. The pure decision is extracted to
`src/messageTrigger.ts` (`messageQualifies(amount, total)`, unit-tested):

```
messageQualifies(amount, total) =
  amount > 0 && (amount % 5 === 0 || total % 5 === 0)
```

It watches `state.log`. **Fields, trade goods and gold are excluded** — they're scored at
game *end* (fields only count once the game is over; goods/gold are tallied in one batch
via the menu), so they never move a figure during play and must not draw a message. The
pure predicate `kindCanTriggerMessage(kind)` (also in `messageTrigger.ts`, unit-tested)
encodes this as an exclude-list (`field`, `gold`, `goodsBonus`), so any future in-play
feature triggers by default. Entry ids are tracked in a `Set` so multiplayer's
optimistic-then-reconciled echo of the same id cannot double-fire; initial load and
snapshot-resync are seeded as history and never alert.

**Discrete in-play scores** (features, message tiles) are judged the moment a single new
entry is prepended, against `messageQualifies(entry.amount, player.score)`. A message
tile's own points are a new score and can chain into another message — exactly as the
rules allow.

**Manual points** need a debounce. The reducer coalesces a rapid manual burst into one
log entry within `MANUAL_MERGE_WINDOW` (3 s) — the entry's `amount` is the running net —
and ±1 taps would otherwise graze a multiple of 5 mid-burst (e.g. nudging 19→22 passes
20). So the hook tracks each manual entry's net `amount` and (re)arms a settle timer on
every change, judging it once — a hair past the merge window (`MANUAL_SETTLE =
MANUAL_MERGE_WINDOW + 300 ms`) so no further taps can fold in — against the **settled
net** and the final total. Tracking for an entry is dropped if it later vanishes (undo,
or a burst netting to 0).

The hook exposes:

```ts
{
  pending: Set<string>            // player ids currently showing a badge
  toast: { id: number } | null    // present briefly after a trigger; drives the toast
  clear: () => void               // clears ALL pending badges (a message was resolved)
  dismiss: (id: string) => void   // removes ONE player's badge (false positive)
  soundOn: boolean
  setSoundOn: (on: boolean) => void
}
```

Side effects on a qualifying trigger: add the player id to `pending`, set `toast`, and
play the chime (if `soundOn`). `clear()` is also called on reset / new game.

## Badges (the active-player solution)

`pending` is a **set** of player ids. If a shared completed feature is scored for
several players in a row and more than one lands on a ÷5, **each shows a 📜 badge** —
because the app cannot know whose turn it is. The human resolves the ambiguity.

The badge is a 📜 chip with **two affordances**:

- **Tap the chip — "this player receives it":** open `ScoreModal` for that player,
  pre-selected to the 📜 Messages form, then `clear()` (all badges go, since only the
  active player draws for that scoring moment).
- **Tap the chip's ✕ — "not their turn":** `dismiss(id)` removes **only that player's**
  badge. This is the case where a player crossed a ÷5 on someone else's turn (e.g. they
  scored from a shared feature the active player completed) and so earns no message —
  and there may be no other badge to "resolve" away. The ✕ clears that false positive
  on its own.

Reset / new game also clears all. Badge details:

- Renders on the player card in `Scoreboard.tsx` for ids in `pending`.
- `aria-label`s for both controls (chip "open message", ✕ "dismiss message") and a
  gentle pulse disabled under `prefers-reduced-motion`.
- Opening the form pre-selected requires threading an initial feature:
  - `Scoreboard` already owns `activeId`/`setActiveId`; add an `initialFeature` state
    set alongside it when a chip is tapped.
  - `ScoreModal` gains `initialFeature?: FeatureType`; when set it forces `tab='preset'`
    and passes it down.
  - `PresetForms` gains `initialFeature?: FeatureType` to seed its `feature` `useState`
    (default stays `'road'`).

## Toast

A **small, generic toast** — deliberately **does not name a player**, because at trigger
time it is not yet known who will actually receive the tile.

- Text: **"📜 A message is available!"** / **"📜 Появилось послание!"**
- `role="status"`, `aria-live="polite"`, auto-dismisses after ~4s; the latest trigger
  replaces any visible toast.
- Lighter weight than `UpdatePrompt`; rendered alongside it. It is an attention nudge —
  the badges are the actionable element.

## Sound

A **short chime** generated with the Web Audio API (a two-note ding) — no bundled asset,
so it stays offline/PWA-friendly and adds no bytes.

- A single shared `AudioContext`, unlocked/resumed on the first user interaction; the
  chime then plays from within the post-score effect (allowed, since it follows a tap).
- A **sound on/off toggle** in the game menu (App header), persisted in `localStorage`
  (default **on**). Badge + toast are full visual equivalents, so nothing depends on
  hearing the chime.
- Implementation lives in a tiny `src/sound.ts` (`playMessageChime()`), kept out of the
  hook so it is trivially testable/mungeable.

## Terminology — align to the new edition

Rename the expansion **display** strings (internal ids `messages` / `message` stay):

| Key | en | ru |
| --- | --- | --- |
| `expansionNames.messages` | The Messengers | Гонцы |
| `expansionDescriptions.messages` | Auto-alerts message tiles (manual points). | Оповещает о тайлах посланий (очки вручную). |
| `messageHint` | …(The Messengers). | …(Гонцы). |

The tile term stays **Message / Послание** (`featureNames.message`, `formatDescriptor`).

New i18n keys (both `en` + `ru`, TypeScript enforces completeness):

| Key | en | ru |
| --- | --- | --- |
| `messageAvailable` | 📜 A message is available! | 📜 Появилось послание! |
| `messageBadgeAria(name)` | `${name} — open message` | `${name} — открыть послание` |
| `messageDismissAria(name)` | `${name} — dismiss message` | `${name} — убрать послание` |
| `soundLabel` | Sound | Звук |

## Wiring / data flow

```
App
 ├─ useGame() ............................ game state (unchanged)
 ├─ useMessageAlerts(game.state) ........ NEW: pending / toast / clear / sound
 ├─ <Scoreboard
 │      pending=…
 │      onOpenMessage=(id)=>{ openModal(id,'message'); clear() }   // chip tap
 │      onDismissMessage=(id)=>dismiss(id) />                       // ✕ tap
 │     └─ player card → 📜 badge (chip + ✕) when id ∈ pending
 │     └─ <ScoreModal initialFeature=… />
 ├─ <MessageToast toast=… />  ........... NEW small toast
 ├─ <UpdatePrompt />
 └─ game menu → Sound toggle (soundOn / setSoundOn)
```

`useGame` is untouched and stays the single source of truth for game state; alerts are a
separate, self-contained module.

## Multiplayer

The hook reads the shared `GameState.log`, so when a remote player scores, every client's
log updates and each client independently fires the alert (badge + toast + chime). Badge
clearing is local UI per client. The id `Set` dedupes the optimistic→reconciled echo.

## Edge cases

- Fields (`field`), trade goods (`goodsBonus`) and gold (`gold`) are scored at game end
  → never trigger.
- `amount === 0` never reaches the hook (`addScore` rejects it) and is excluded anyway.
- Negative amounts / a manual burst netting ≤ 0 do not trigger (`amount > 0`).
- Incremental ±1 manual taps that graze a multiple of 5 mid-burst do **not** misfire —
  only the settled net is judged.
- Reload mid-resolution clears pending badges (ephemeral) — acceptable.
- Message-tile points chaining into another message is allowed (rules-accurate).
- Expansion disabled → hook is inert (gated on `state.expansions.messages`).

## Out of scope

- Persisting pending badges across reloads.
- Tracking/visualising the two figures' board positions.
- Automating the tile's own resolution (stays manual via the 📜 Messages form).
- Per-player "active turn" tracking (the badge-set, chip-to-resolve, and ✕-to-dismiss
  are the deliberate substitute).

## Verification

- `npm run build` stays green (strict type-check; new i18n keys must exist in both `en`
  and `ru`) and `npm run test:run` passes (incl. `messageTrigger.test.ts`).
- Manual: enable The Messengers; score 5 / 10 → badge + toast + chime on that player;
  score 3 then 2 (total 5) → fires on the second; score 3 (total 3) → no fire; tap a
  badge chip → opens that player's 📜 Messages form and all badges clear; tap a badge's
  ✕ → only that player's badge goes, the rest stay; toggle Sound off → no chime,
  badge/toast still appear; reduced-motion → no pulse.
- Manual debounce: rapidly tap +1 from 19→22 (passes 20) → **no** alert; tap +1 from
  10→15 (net 5) → alert fires once the taps settle (~3.3 s). Verified live in-browser.
- End-game tallies: record gold, then "Score gold" landing a player on a multiple of 5
  (e.g. 15→25) → **no** alert. Verified live in-browser.
```