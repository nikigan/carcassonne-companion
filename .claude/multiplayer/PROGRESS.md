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

**Verified:** 14/14 unit tests pass, `npm run build` green, headless two-client integration test (create→join→bidirectional sync→dedup) passed against real workerd+DO; visual two-browser UI testing still recommended (browser extension was unavailable in the build environment).

## Deferred (out of scope this pass; TODOs in src/server/index.ts)

- Presence (who's connected)
- Host-only gating for destructive actions
- Idle-room alarm cleanup

## Decisions

- Shared-scoreboard model (any device edits any score; full trust).
- Optimistic reconciliation: confirmed base + pending replay (`src/game/roomSync.ts`).
- Create seeds the room from the current local game (POST seed, then connect).
- Join by `/r/<code>` URL, QR of that URL, or 6-char code.
