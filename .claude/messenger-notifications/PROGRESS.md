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

## Notes
- No test runner; `npm run build` is the gate.
- Commits carry no AI co-author trailer (global rule; removed from CLAUDE.md).
