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
UI state**, not part of `GameState`/localStorage.

- It watches `state.log`. It fires **only when a single new entry is prepended**
  (`log.length` grew by 1 and `log[0].id` is unseen). Undo (length shrinks), initial
  load, and multiplayer snapshot-resync (bulk change) therefore never fire it.
- Entry ids are tracked in a `Set` so multiplayer's optimistic-then-reconciled echo of
  the same id cannot double-fire.
- For the newest entry it evaluates:

  ```
  qualifies =
       state.expansions.messages           // expansion enabled
    && entry.amount > 0
    && (entry.amount % 5 === 0  ||  player.score % 5 === 0)
  ```

  `player.score` is the player's current total — valid because the newest entry is the
  last one applied.

Because the check runs on **any** points source (features, trade goods, gold, manual),
all of which move a figure, it correctly covers them all. A message tile's own points
are entered as a new score and can therefore chain into another message — which is
exactly how the rules work.

The hook exposes:

```ts
{
  pending: Set<string>          // player ids currently showing a badge
  toast: { id: number } | null  // present briefly after a trigger; drives the toast
  clear: () => void             // clears all pending badges
  soundOn: boolean
  setSoundOn: (on: boolean) => void
}
```

Side effects on a qualifying trigger: add the player id to `pending`, set `toast`, and
play the chime (if `soundOn`). `clear()` is also called on reset / new game.

## Badges (the active-player solution)

`pending` is a **set** of player ids. If a shared completed feature is scored for
several players in a row and more than one lands on a ÷5, **each shows a 📜 badge** —
because the app cannot know whose turn it is. The human does: **tapping any badge opens
that player's Messages form and clears every badge** (only the active player actually
draws). Reset / new game also clears.

- Badge renders on the player card in `Scoreboard.tsx` for ids in `pending`.
- It has an `aria-label` (e.g. "{name} — open message") and a gentle pulse that is
  disabled under `prefers-reduced-motion`.
- **Tap behavior:** open `ScoreModal` for that player, pre-selected to the 📜 Messages
  form, then `clear()`. This requires threading an initial feature:
  - `Scoreboard` already owns `activeId`/`setActiveId`; add an `initialFeature` state
    set alongside it when a badge is tapped.
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
| `soundLabel` | Sound | Звук |

## Wiring / data flow

```
App
 ├─ useGame() ............................ game state (unchanged)
 ├─ useMessageAlerts(game.state) ........ NEW: pending / toast / clear / sound
 ├─ <Scoreboard pending=… onOpenMessage=(id)=>{ openModal(id,'message'); clear() } />
 │     └─ player card → 📜 badge when id ∈ pending
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

- `amount === 0` never reaches the hook (`addScore` rejects it) and is excluded anyway.
- Negative amounts (manual corrections) do not trigger (`amount > 0`).
- Reload mid-resolution clears pending badges (ephemeral) — acceptable.
- Message-tile points chaining into another message is allowed (rules-accurate).
- Expansion disabled → hook is inert (gated on `state.expansions.messages`).

## Out of scope

- Persisting pending badges across reloads.
- Tracking/visualising the two figures' board positions.
- Automating the tile's own resolution (stays manual via the 📜 Messages form).
- Per-player "active turn" tracking (the badge-set + tap-to-clear is the deliberate
  substitute).

## Verification

- `npm run build` stays green (strict type-check is the gate; new i18n keys must exist
  in both `en` and `ru`).
- Manual: enable The Messengers; score 5 / 10 → badge + toast + chime on that player;
  score 3 then 2 (total 5) → fires on the second; score 3 (total 3) → no fire; tap a
  badge → opens that player's 📜 Messages form and all badges clear; toggle Sound off →
  no chime, badge/toast still appear; reduced-motion → no pulse.
```