# UX fixes: message sync + menu + responsive title

Four issues reported by the user. Design approved: badges become **synced game
state** (Option A), one commit per issue (#1+#2 land together).

## Issues

1. **New joiner replays message notifications** — should only be notified for
   messages earned *after* they connect.
2. **Message badge dismiss/clear must broadcast** to everyone in the room.
3. **Header user menu** ("Menu ▾") doesn't close on outside click — its
   `fixed inset-0` overlay is trapped inside the header's `backdrop-blur`
   containing block, so it only covers the header strip.
4. **"Carcassonne / Companion" title** should hide on screens narrower than
   iPhone 16 Pro Max (`< 440px`), keeping the 🏰 icon.

## Approach

### #1 + #2 — `pendingMessages` in GameState
- `types.ts`: `GameState.pendingMessages: string[]`.
- `reducer.ts` + `emptyGame`: add `pendingMessages: []`; new idempotent actions
  `earnMessage{playerId}`, `dismissMessage{playerId}`, `resolveMessages`; clear
  the set on `resetScores`/`newGame`. Read `s.pendingMessages ?? []` (old DO
  rooms predate the field).
- `storage.ts`: migrate solo saves to default `[]`.
- `useGame.ts`: expose `earnMessage` / `dismissMessage` / `resolveMessages`.
- `useRoom.ts`: expose `syncEpoch`, bumped on every snapshot applied + on leave.
- `useMessageAlerts.ts`: render badges from `state.pendingMessages`; on detect →
  chime/toast + `earnMessage`; reseed (no fire) on first run or `syncEpoch`
  change (fixes #1); `dismiss`→`dismissMessage`, `clear`→`resolveMessages`.
- `Scoreboard.tsx` / `App.tsx`: wire through.
- `reducer.test.ts`: cover the three actions + reset/newGame clearing.

### #3 — App.tsx: replace overlay div with a document `pointerdown` close listener.
### #4 — App.tsx: wrap `<h1>` text in `max-[439px]:hidden`.

## Status
- [x] #4 hide title — commit 655acab
- [x] #3 menu outside-click — commit 5008d6d
- [x] #1+#2 message sync — build clean, 40 tests pass
- [x] build + tests green (npm run build + test:run)

## Notes / verification
- Reducer fully unit-tested (6 new cases). UI hook logic traced for solo +
  multiplayer (join/dismiss/resolve/reconnect). Cross-client behavior not
  auto-testable (needs 2 clients) — reasoned through, see commit message.
- Every client detects the same in-play move → each dispatches `earnMessage`
  (idempotent) and chimes locally; that's why earn is idempotent in the reducer.
- Old DO rooms / saves predate `pendingMessages`; all reads default `?? []`.
