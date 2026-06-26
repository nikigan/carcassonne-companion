# Multiplayer rooms — progress

Live shared game sessions: one Durable Object per room, authoritative over a
WebSocket; a pure `applyAction` reducer shared by client and server; optimistic
client updates with echo reconciliation. Solo (no-room) play stays the default.

- **Spec:** `docs/superpowers/specs/2026-06-26-multiplayer-rooms-design.md`
- **Plan:** `docs/superpowers/plans/2026-06-26-multiplayer-rooms.md`
- **Branch:** `multiplayer-rooms`

## Status

| # | Task | Status |
|---|------|--------|
| 1 | Pure reducer + Vitest | ✅ done (32cf382) |
| 2 | Rewire useGame solo path onto reducer | ✅ done (2278b09) |
| 3 | Protocol types + pure reconciliation (roomSync) | ✅ done (c6286a1) |
| 4 | GameRoom Durable Object + Worker + config | ✅ done (7435e6c) |
| 5 | Client WebSocket transport (roomConnection) | ✅ done (22918b5) |
| 6 | Room mode in useGame (+ URL + storage) | ✅ done (b049ddc) |
| 7 | UI — share / join / QR / status (+ i18n) | ✅ done (6e02245) |
| 8 | Integration verification + docs | ✅ done |

**Verified:** 25/25 unit tests pass (reducer + roomSync + protocol), `npm run build` green, and headless runtime tests against the real workerd+DO all pass — two-client (create→join→bidirectional sync→dedup) and host-gating (non-host newGame rejected, host applies). Visual two-browser UI testing still recommended (browser extension was unavailable in the build environment).

## Follow-up pass (2026-06) — shipped

- Host-only gating: `newGame`/`resetScores` require the creator's token (per-room
  localStorage); non-hosts don't see those menu items (`src/useRoom.ts`, server guard).
- Idle-room cleanup: DO storage alarm deletes a room after 7 days idle (reschedules
  while clients are connected).
- Reconnect/join polish: single `reconnecting` event, `forceReconnect` on a seq gap,
  no dropped action on an uncached join, room-code validation on `/r/<code>`.
- Server hardening: 400 on a malformed seed, array-action guard, recreate the SQL
  table after the alarm's `deleteAll`.
- Refactor: room logic extracted from `useGame.ts` into `src/useRoom.ts`.

## Still deferred (TODOs in src/server/index.ts)

- Presence (who's connected)
- Surface server `RoomErrorMsg` to the client (echo the rejected actionId so a
  rejected optimistic action can be dropped) — currently unreachable via the UI.

## Decisions

- Shared-scoreboard model (any device edits any score; full trust).
- Optimistic reconciliation: confirmed base + pending replay (`src/game/roomSync.ts`).
- Create seeds the room from the current local game (POST seed, then connect).
- Join by `/r/<code>` URL, QR of that URL, or 6-char code.
