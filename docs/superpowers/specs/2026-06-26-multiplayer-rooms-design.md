# Multiplayer rooms — design

**Date:** 2026-06-26
**Status:** Approved (brainstorming) — pending spec review before planning
**Source doc:** [`docs/multiplayer.md`](../../multiplayer.md)

## Goal

Let several devices share **one live game session**: anyone creates a room, others
join by URL (or QR / code), and the scoreboard + score log update in real time as
anyone records points. Single-device play is unchanged and stays the default.

## Locked decisions

- **Shared scoreboard model.** A room is one shared `GameState`. Any connected
  device can record points for **any** player and run any game action
  (add/remove players, undo, expansions, reset, new game). Full trust — this is an
  at-the-table companion. No per-player seats, no permissions.
- **Scope: core sync + reconnect.** Create/join by URL, authoritative Durable
  Object over WebSocket, optimistic UI with echo reconciliation, per-room
  localStorage cache, auto-reconnect with snapshot resync. **Deferred** (left as
  `TODO` markers, not built): presence ("who's connected") UI, host-only gating,
  idle-room alarm cleanup.
- **Create seeds from the current game.** Creating a room uploads the current
  local players / scores / log / expansion selection as the room's initial state.
- **Optimistic reconciliation: confirmed-base + pending replay** (model A below).
- **Share affordances:** copy link **and** a QR code of the join URL, plus a
  manual "join by code" input.

## Architecture overview

```
device A ─┐
device B ─┼─ WebSocket ─▶  Worker (router)  ──▶  GameRoom DO  (getByName(code))
device C ─┘                static assets ◀──        │  authoritative GameState + seq
                                                     │  SQLite (persist before broadcast)
                                                     └─ broadcasts each applied action
```

The cornerstone is a **single pure reducer shared by client and server**, so the
DO and every client compute identical state from identical actions.

### 1. Shared reducer (`src/game/reducer.ts`, new)

Extract all game mutation logic out of `useGame.ts` into a pure function:

```ts
applyAction(state: GameState, action: GameAction): GameState
```

- **Pure & deterministic.** No React, no DOM, no `uid()`, no `Date.now()`. Every
  impure value (new ids, timestamps) is carried in the action payload, generated
  at the dispatch edge. Multi-entry actions derive child entry ids deterministically
  as `` `${action.id}-${i}` ``.
- Imports only pure modules already in the tree: `types.ts`, `scoring.ts`,
  `expansions.ts`. These import cleanly server-side (no browser globals).
- The manual-merge coalescing (today's `applyManual`) moves here verbatim, reading
  `timestamp` from the action instead of calling `Date.now()`. It stays
  deterministic: same action + same state → same merge result.

#### `GameAction` union

One variant per existing `useGame` intent. Domain ids/timestamps travel in the
payload:

```ts
type GameAction =
  | { type: 'addPlayer'; id: string; name: string; color: string }
  | { type: 'updatePlayer'; id: string; patch: Partial<Pick<Player,'name'|'color'>> }
  | { type: 'removePlayer'; id: string }
  | { type: 'startGame' }
  | { type: 'editPlayers' }
  | { type: 'setExpansion'; expansion: ExpansionId; on: boolean }
  | { type: 'addScore'; id: string; playerId: string; amount: number;
      desc: ScoreDescriptor; timestamp: number }
  | { type: 'recordTokens'; playerId: string; delta: TokenDelta }
  | { type: 'scoreTradeGoods'; id: string; timestamp: number }  // entries: `${id}-${i}`
  | { type: 'scoreGoldIngots'; id: string; timestamp: number }  // entries: `${id}-${i}`
  | { type: 'undoEntry'; entryId: string }
  | { type: 'resetScores' }
  | { type: 'newGame' }
```

### 2. `useGame` becomes a mode-aware dispatcher

`useGame`'s **public API is unchanged** (`addScore`, `addPlayer`, `recordTokens`,
…) so **no presentational component changes for existing behavior.** Each method
now builds a `GameAction` (generating ids/timestamps here, the impure edge) and
**dispatches** it. Dispatch has two modes:

- **Solo (no room):** `state = applyAction(state, action)`; persist to
  `localStorage`. Behaviorally identical to today.
- **Room:** apply optimistically (see reconciliation), send the action over the
  socket, reconcile on echo; cache to the per-room key.

New hook surface for rooms:
`createRoom()`, `joinRoom(code)`, `leaveRoom()`, and read-only
`room: { code: string; status: 'connecting'|'open'|'reconnecting'|'closed' } | null`.

### 3. Reconciliation — confirmed-base + pending replay (model A)

Each client keeps:
- `confirmed`: last authoritative `GameState` (from a snapshot, advanced by server
  actions applied **in `seq` order**).
- `pending`: queue of local `{ actionId, action }` not yet echoed by the server.
- **Displayed (what the UI renders) = `pending.reduce(applyAction, confirmed)`.**

Flow:
- **Local action:** push to `pending`, recompute displayed, send
  `{ type:'action', actionId, action }`.
- **Server action `{ actionId, action, seq }`:** apply to `confirmed`
  (expect `seq === confirmedSeq + 1`); if `actionId` matches a pending entry,
  remove it; recompute displayed. On a `seq` gap, request a fresh snapshot.
- **Snapshot `{ state, seq, recentActionIds }`:** replace `confirmed`; drop any
  pending whose `actionId ∈ recentActionIds` (already applied server-side);
  resend the rest; recompute displayed.

This is the honest "optimistic" implementation: brief local divergence self-heals,
ordering is always the server's, and reconnect never double-applies or loses an
action. `actionId` is transport-only (dedup + pending match); it's distinct from
domain ids like player id / entry id.

### 4. Wire protocol

Client → server:
- `{ type:'init', state }` — sent once by the creator to seed the room.
- `{ type:'action', actionId, action }`
- `{ type:'hello' }` — on (re)connect, request a snapshot.

Server → client:
- `{ type:'snapshot', state, seq, recentActionIds }`
- `{ type:'action', actionId, action, seq }` — broadcast to **all** sockets,
  including the originator (its echo).
- `{ type:'error', message }`

### 5. `GameRoom` Durable Object (`src/server/index.ts`, new)

- One DO instance per room, addressed `env.GAME_ROOM.getByName(code)`.
- Holds authoritative `GameState`, a monotonic `seq`, and a **bounded set of
  applied `actionId`s** (most recent ~500) for resend dedup.
- **WebSocket Hibernation API** (`ctx.acceptWebSocket`) so idle rooms don't bill.
  Use the hibernatable `webSocketMessage` / `webSocketClose` handlers.
- On connect → send a `snapshot`.
- On `action` → if `actionId` already applied, just re-echo it to the sender
  (lets them clear pending); else `applyAction`, **persist to SQLite first**,
  bump `seq`, record `actionId`, then **broadcast** the action.
- On `init` → seed authoritative state **only if the room is empty**; otherwise
  ignore (a code collision simply joins the existing room).
- `webSocketClose` handled (socket cleanup) but **no presence broadcast** (deferred).
- **Persistence:** single JSON blob (`state`) + `seq` + recent `actionId`s in
  `ctx.storage.sql`. A score log is small, so full-snapshot-on-reconnect beats
  per-entry replay. Persist **before** broadcasting (no recorded score lost on
  eviction/crash).
- **Deferred TODOs (commented, not built):** idle-room expiry `alarm`, presence.

### 6. Worker router (`src/server/index.ts` default export)

```ts
export default {
  async fetch(req, env) {
    const m = new URL(req.url).pathname.match(/^\/api\/room\/([a-z0-9-]+)\/ws$/i)
    if (m) return env.GAME_ROOM.getByName(m[1]).fetch(req)
    return env.ASSETS.fetch(req)               // SPA + static assets unchanged
  },
}
```

Exact Cloudflare API signatures (`getByName`, `acceptWebSocket`,
`WebSocketPair`, SQL API, env typing) **verified against live Cloudflare docs at
implementation time** (repo policy + the doc's own warning that these move fast).

### 7. Client room transport (`src/game/roomConnection.ts`, new)

A small, framework-free WebSocket client: dial
`wss://<host>/api/room/<code>/ws`, parse/emit typed messages, and **auto-reconnect
with backoff**, resending unacked pending actions and re-syncing from the snapshot.
`useGame` consumes it; the reconciliation state machine (§3) lives in `useGame` (or
a `useRoom` helper it composes).

### 8. URLs & routing

- **Join URL:** `https://carcassonne.gankin.xyz/r/<code>`. The existing SPA
  fallback (`not_found_handling: single-page-application`) already serves
  `index.html` for it.
- **No router library.** A ~20-line helper (`src/game/roomUrl.ts`) reads
  `location.pathname` on load (auto-join if it matches `/r/<code>`) and uses the
  History API to set `/r/<code>` on join and clear it on leave.
- **Room code:** 6 chars from an unambiguous alphabet (no `0/O/1/l`), generated
  client-side on create.

### 9. Storage keys (`src/storage.ts`)

- Solo game: `carcassonne-companion:game` (unchanged).
- Room cache: `carcassonne-companion:room:<code>` (the confirmed state, for instant
  reload + reconnect).
- Active-room pointer: `carcassonne-companion:active-room` = `code | null`, so a
  refresh rejoins the room. **Leaving clears it and restores the solo game
  untouched.**

### 10. UI surface (all strings localized en + ru)

- **PlayerSetup:** a "Play on multiple devices" action → `createRoom()` (seeds
  from the current setup).
- **In-game menu (`App.tsx`):**
  - Solo → "Share game" → `createRoom()`.
  - In a room → a **room panel**: the code, a **Copy link** button, a **QR code**
    of the join URL, and **Leave room**.
  - A "Join by code" input (URL is the primary join path; this aids manual entry
    + testing).
- **Header badge** when in a room: room code + own connection status
  (Connecting / Connected / Reconnecting). This is the local socket status, **not**
  presence.
- **QR code:** rendered with `qrcode.react` (`<QRCodeSVG value={joinUrl} />`),
  added as a dependency. Library API verified against live docs before use.

### 11. i18n

New keys in the `Strings` interface (both `en` and `ru`, TypeScript enforces
completeness): playOnMultipleDevices, shareGame, room, roomCode, joinRoom,
joinByCode, copyLink, linkCopied, scanToJoin, leaveRoom, connecting, connected,
reconnecting, plus any confirm/leave prompts. These are app-UI terms (not
Carcassonne rule terms), so normal idiomatic Russian.

### 12. Config & dev (`wrangler.jsonc`, `vite.config.ts`, `package.json`)

- `wrangler.jsonc` gains: `"main": "src/server/index.ts"`,
  `assets.binding: "ASSETS"`, a `GAME_ROOM` durable-object binding, and the
  `v1` `new_sqlite_classes: ["GameRoom"]` migration. Assets stay served directly;
  the Worker only runs for `/api/*`.
- **Local end-to-end dev:** wire up **`@cloudflare/vite-plugin`** so `npm run dev`
  runs the client **and** the DO together (HMR + workerd/miniflare). Exact plugin
  name/config **verified against live Cloudflare docs** before writing. Solo play
  still works under plain Vite if the worker isn't running (room actions just fail
  to connect → status shows reconnecting).
- `npm run build` (`tsc -b && vite build`) stays the gate; the server entry must
  type-check too.
- CI/CD (Cloudflare Workers Builds on push to `main`) is unaffected — it already
  runs `npm run build` then `wrangler deploy`.

## Invariants to preserve

- Score log entries stay **structured `ScoreDescriptor`s**, never localized
  strings — the wire format is language-agnostic; clients localize via
  `formatDescriptor`.
- All user-facing text in `src/i18n.ts` with **both** `en` + `ru`.
- `npm run build` stays green.
- Solo (no-room) behavior is **byte-for-byte unchanged** from today.

## Out of scope (this pass)

Presence UI, host-only action gating, idle-room alarm cleanup. Each is a clean
additive follow-up; left as commented `TODO`s where they'd hook in.

## File-by-file change list

**New:**
- `src/game/reducer.ts` — pure `applyAction` + `GameAction` union.
- `src/game/roomConnection.ts` — WebSocket client + reconnect.
- `src/game/roomUrl.ts` — `/r/<code>` read/write helper + code generator.
- `src/server/index.ts` — Worker router + `GameRoom` DO.
- `worker-configuration.d.ts` (or equivalent) — `Env` typing for bindings.

**Changed:**
- `src/useGame.ts` — mode-aware dispatcher around `applyAction`; room state +
  `createRoom`/`joinRoom`/`leaveRoom`.
- `src/storage.ts` — room cache + active-room pointer helpers.
- `src/App.tsx` — share/room menu, header status badge, auto-join on load.
- `src/components/PlayerSetup.tsx` — "Play on multiple devices" entry.
- `src/components/Scoreboard.tsx` — (only if a room badge needs threading; aim none).
- `src/i18n.ts` — new keys, en + ru.
- `wrangler.jsonc`, `vite.config.ts`, `package.json` — config + `qrcode.react` dep.

## Verification checklist (must hold before "done")

- [ ] `npm run build` green (client + server type-check).
- [ ] Solo play identical to today (create/score/undo/reset/new game, reload
      restores).
- [ ] Two browsers in one room: a score on A appears on B within ~one round-trip,
      optimistically instant on A.
- [ ] Join by URL, by QR scan, and by code all reach the same room.
- [ ] Kill + restore the socket: pending actions resend, no double-apply, no loss.
- [ ] Leave room → solo game restored untouched.

## Open items to verify against live docs (per repo policy)

1. Cloudflare Durable Objects current API: `WebSocketPair`, `acceptWebSocket`
   (Hibernation), `ctx.storage.sql`, `getByName`, `wrangler.jsonc` DO bindings +
   SQLite migration syntax.
2. `@cloudflare/vite-plugin` exact name, version, and config for Workers + assets +
   DO with HMR.
3. `qrcode.react` current export/API (`QRCodeSVG`).
