# The Messengers — message notifications · PROGRESS

Feature: notify when a player earns a Messengers message tile (badge + toast + chime).

- Design spec: `docs/superpowers/specs/2026-06-27-messenger-notifications-design.md`
- Plan: `docs/superpowers/plans/2026-06-27-messenger-notifications.md`

## Trigger (the engine)
A message fires when `amount > 0 && (amount % 5 === 0 || newTotal % 5 === 0)`,
on a single new log entry, de-duped by id. Proven optimal; collapses the
two-marker rule to one check.

## Tasks
- [x] 1. `src/sound.ts` — Web Audio chime + unlock
- [x] 2. `src/useMessageAlerts.ts` — trigger hook (pending/toast/clear/dismiss/sound)
- [x] 3. `src/i18n.ts` — new strings (en+ru) + rename to The Messengers / Гонцы
- [x] 4. `src/components/ScoreModal.tsx` — `initialFeature` prop
- [x] 5. `src/components/Scoreboard.tsx` — per-player 📜 badges (tap opens form, ✕ dismisses)
- [x] 6. `src/App.tsx` — wire hook, toast, sound toggle, clear on reset/new game

Status: DONE. `npm run build` green; live browser smoke test passed —
score 5 → badge + toast; score 3 → none; score 2 (total 5) → badge (meeple
path); ✕ dismisses one badge; tapping a chip opens that player's Message form
pre-selected and clears all badges; EN/RU rename verified; no console errors.

## Follow-up: manual debounce (done)
Manual points are entered incrementally and the reducer coalesces a burst
(within MANUAL_MERGE_WINDOW=3s) into one entry whose `amount` is the running
net. The hook now judges manual entries on their **settled net** (timer
re-armed on each change, fires at MANUAL_MERGE_WINDOW+300ms) instead of per
tap — so nudging e.g. 19→22 (passes 20) no longer misfires.
- Extracted pure `src/messageTrigger.ts` (`messageQualifies`) + Vitest
  `src/messageTrigger.test.ts` (4 cases). Exported `MANUAL_MERGE_WINDOW` from
  `src/game/reducer.ts`.
- Verified live: 19→22 (passes 20) → no alert; 10→15 (net 5) → alert after
  settle. All 29 tests pass; build green.
- Note: project DOES have Vitest (CLAUDE.md was stale; fixed).

## Follow-up: exclude end-game scores (done)
Fields, trade goods and gold are scored at game end, so they must not draw a
message. Added pure `kindCanTriggerMessage(kind)` to `messageTrigger.ts`
(exclude-list: field, gold, goodsBonus) + Vitest cases; the hook's discrete
path gates on it.
- Verified live: recorded 5 gold for Ann (15), "Score gold" → +10 → 25 (lands
  on multiple of 5, amount ÷5) → no badge/toast. `field` added after by the
  same mechanism (unit-tested). 31 tests pass; build green.

## Notes
- No test runner; `npm run build` is the gate.
- Commits carry no AI co-author trailer (global rule; removed from CLAUDE.md).
