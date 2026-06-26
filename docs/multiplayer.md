# Adding multiplayer (future)

This app is currently a **single-device** score tracker: state lives in one
browser via `localStorage` (`src/useGame.ts`). "Multiplayer" here means **one
shared game session synced live across several devices** — each player opens the
app, joins the same room, and everyone sees the scoreboard and score log update
in real time as anyone records points.

Nothing below is built yet. The deployment was chosen (Cloudflare **Worker with
Static Assets**, see `wrangler.jsonc`) so all of this is a purely **additive**
step — no re-platforming.

> ⚠️ Cloudflare APIs move fast. Treat the code here as a sketch and verify exact
> signatures against the current docs when you implement (per repo policy of
> fetching live docs for external tools). Start points:
> <https://developers.cloudflare.com/durable-objects/> and
> <https://developers.cloudflare.com/durable-objects/best-practices/websockets/>.

## Recommended architecture

**One Durable Object (DO) instance per game room**, holding the authoritative
`GameState`, with each player's device connected over a **WebSocket**. The DO is
single-threaded, so it serializes all mutations — no score races, no merge
conflicts. The existing Worker keeps serving the static SPA; we add a `main`
entry that routes `/api/room/*` to the DO and lets everything else fall through
to assets.

```
player A ─┐
player B ─┼─ WebSocket ─▶  Worker (router)  ──▶  GameRoom DO  (idFromName(roomCode))
player C ─┘                static assets ◀──        │  authoritative GameState
                                                     │  SQLite storage (persist)
                                                     └─ broadcasts deltas to all sockets
```

### Why this fits the existing design
- **The score log is already an append-only event stream.** Each `ScoreEntry`
  holds a structured `ScoreDescriptor` (never a pre-rendered string — see
  CLAUDE.md "Scoring is data, not strings"). That is exactly the right shape to
  broadcast: the DO appends an entry and pushes that one entry to every client.
  Clients re-localize it themselves via `formatDescriptor`, so the wire format
  stays language-agnostic.
- **`useGame` already exposes intent-named actions** (`addScore`, `recordTokens`,
  `scoreTradeGoods`, `undoEntry`, …). Those map almost 1:1 onto **DO RPC methods**
  / WebSocket message types. The DO becomes the server-side mirror of `useGame`.
- **The source of truth is decided by one thing: does a game room exist?**
  - **No room → `localStorage` is authoritative, exactly as today.** No socket is
    opened and `useGame` behaves identically to the current single-device app.
    This is also precisely what "offline" means — so **"offline" and "no room"
    are the same state**, and there is no separate offline code path to build or
    keep in sync.
  - **Room exists → the DO is authoritative.** `localStorage` drops to a local
    cache used only for fast reload + reconnection.

## Worker + DO sketch

```ts
// src/server/index.ts  (new "main" entry)
import { DurableObject } from "cloudflare:workers";

export class GameRoom extends DurableObject<Env> {
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    ctx.blockConcurrencyWhile(async () => {
      ctx.storage.sql.exec(`CREATE TABLE IF NOT EXISTS state (
        k TEXT PRIMARY KEY, v TEXT NOT NULL)`); // store one JSON GameState blob, or normalize
    });
  }

  async fetch(req: Request) {                      // WebSocket upgrade entrypoint
    const [client, server] = Object.values(new WebSocketPair());
    this.ctx.acceptWebSocket(server);              // Hibernation API → no idle billing
    server.send(JSON.stringify({ type: "snapshot", state: this.load() }));
    return new Response(null, { status: 101, webSocket: client });
  }

  // Hibernatable handlers (replace ws.addEventListener)
  webSocketMessage(ws: WebSocket, raw: string) {
    const msg = JSON.parse(raw);                    // { type: "addScore", playerId, descriptor } ...
    const entry = this.applyIntent(msg);            // mutate authoritative state, persist FIRST
    this.broadcast({ type: "entry", entry });       // then fan out the delta
  }
  webSocketClose(ws: WebSocket) { /* update presence */ }

  private broadcast(m: unknown) {
    const data = JSON.stringify(m);
    for (const ws of this.ctx.getWebSockets()) ws.send(data);
  }
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    const m = url.pathname.match(/^\/api\/room\/([a-z0-9-]+)\/ws$/i);
    if (m) {
      const room = env.GAME_ROOM.getByName(m[1]);   // roomCode → same DO every time
      return room.fetch(req);
    }
    return env.ASSETS.fetch(req);                    // everything else → the SPA
  },
};
```

### `wrangler.jsonc` additions (when you implement)
```jsonc
{
  // ...existing assets-only config, plus:
  "main": "src/server/index.ts",
  "assets": { "directory": "./dist", "binding": "ASSETS",
              "not_found_handling": "single-page-application" },
  "durable_objects": { "bindings": [{ "name": "GAME_ROOM", "class_name": "GameRoom" }] },
  "migrations": [{ "tag": "v1", "new_sqlite_classes": ["GameRoom"] }]
}
```
Note: once `main` + `assets.binding` exist, asset requests are still served
directly (free, no Worker invocation); the Worker only runs for `/api/*`.

## Client changes (`src/useGame.ts`)
- **Default mode is "no room":** state lives in `localStorage` and `useGame` runs
  exactly as today. Going offline changes nothing — offline *is* "no room", so the
  same path covers both.
- Add a `roomCode` concept: create a room (random short code) or join one. Only
  this switches the source of truth to the DO.
- When in a room, open `wss://carcassonne.gankin.xyz/api/room/<code>/ws`.
- On `snapshot` → replace local state; on `entry` → append to the log + recompute.
- Route the existing actions through the socket instead of mutating locally
  (optimistic update + reconcile on echo, or wait-for-echo for simplicity).
- Keep `localStorage` writes as a cache so a refresh restores instantly and a
  dropped socket can resume by reconnecting with the same `roomCode`.

## Consistency, persistence, reconnection
- **Authoritative & serialized:** all mutations go through the DO; it is the only
  writer, so last-write-wins is well-defined and there are no races.
- **Persist before cache:** write to `ctx.storage` *before* updating in-memory /
  broadcasting, so an eviction or crash never loses a recorded score.
- **Reconnect:** client redials with the `roomCode`; the DO replays the current
  snapshot (or, if you keep per-entry rows, the entries after the client's last
  seen index).
- **Cleanup:** set a DO **alarm** to expire idle rooms (e.g. delete state after N
  days) so storage doesn't grow forever.

## Alternatives considered
- **Cloudflare Agents SDK** (`agents`) — DO-based, ships state-sync + WebSocket +
  React hooks. Convenient, but oriented around AI agents; for a plain game room
  it adds concepts we don't need. Revisit only if the feature set grows.
- **`partyserver` / PartyKit-style libs** — thin ergonomic wrapper over DOs for
  exactly this "rooms" pattern; reasonable if hand-rolling the WebSocket
  plumbing feels heavy.
- **Polling a D1 table instead of WebSockets** — simpler, but laggy and chatty;
  not worth it for a live scoreboard. DO + WebSocket is the right primitive.

## Suggested rollout (incremental, each shippable)
1. **Wire the platform:** add `main`, the `GameRoom` DO, bindings/migrations;
   ship a no-op `/api/room/:code/ws` that just echoes a snapshot. Static site
   unchanged.
2. **Mirror state server-side:** move `GameState` mutations into DO RPC/message
   handlers; keep the client local-only but dual-write to validate parity.
3. **Go live:** add room create/join UI, switch the client to socket-driven
   state in multiplayer mode, keep solo (`localStorage`) as the default path.
4. **Polish:** presence (who's connected), host controls, idle-room alarm cleanup,
   reconnection replay.

## Don't break these existing invariants
- Keep storing structured `ScoreDescriptor`s, never localized strings (live
  re-localization depends on it).
- Keep all user-facing text in `src/i18n.ts` with both `en` + `ru`.
- Keep `npm run build` green — it's the gate.
