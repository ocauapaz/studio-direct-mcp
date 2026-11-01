# Architecture

One process, two edges, one policy layer in the middle.

```
stdin ──▶ server.mjs ──▶ tools/  ──▶ bridge.mjs ──▶ WebSocket ──▶ Studio
        (MCP protocol)  (policy)    (transport)
```

## Layers and why they are split

**`protocol.mjs` — pure.** Frame shapes, parsing, text rendering. No socket, no I/O. Anything
here is unit-testable and must stay that way.

**`args.mjs` — pure.** Validation. Runs before a frame is written, so a bad call fails with a
readable message instead of a Studio error.

**`bridge.mjs` — the only stateful part.** Connection, auth header, reconnect with backoff,
request/reply correlation, timeouts. It knows nothing about tools.

**`tools/` — policy.** Which tools exist, what their schemas are, how a call maps onto Studio
calls. Custom tools live here and nowhere else.

**`server.mjs` — wiring.** MCP over stdio, dispatch, shutdown. Thin on purpose.

Splitting this way means a tool change never touches the socket code, and the socket can be
reasoned about without reading tool logic.

## Request path

1. `stdin` line → JSON parse. A bad line is logged, not fatal.
2. `notifications/*` are consumed locally; `initialize`, `ping`, `tools/list`, `tools/call`
   are handled.
3. `tools/call`: a custom tool runs in-process; anything else is validated
   (`studio_id` required) and forwarded.
4. Failure in the handler is caught and returned as an `isError` result — a client never sees
   a dropped call.

## Catalog handling

The host sends the whole Studio catalog on connect. It is cached and merged *behind* the
custom tools, so:

- Custom names always resolve first. A custom tool may deliberately shadow a Studio one.
- A later `tools_updated` replaces the cache and re-emits
  `notifications/tools/list_changed`, unless it is the first one.

## Connection state

`connected` is false until the socket opens and false again on close. Frames written while
down are queued and flushed on reconnect, in order. Pending requests are failed at once on
disconnect with `bridge disconnected: …` rather than left hanging; tool calls are not retried,
because a `execute_luau` that half-ran must not silently run twice.

Reconnect backs off 500 ms → 10 s and never gives up.

## Timeouts

| Kind | Default | Env |
| --- | --- | --- |
| Tool call | 600 000 ms | `STUDIO_MCP_TOOL_TIMEOUT_MS` |
| Control (listing) | 15 000 ms | `STUDIO_MCP_CONTROL_TIMEOUT_MS` |

Ten minutes matches Studio: one long `execute_luau` chunk can legitimately take that.

## Extension points

- New tool: `src/tools/*.mjs` + one array entry. See [ADDING-TOOLS.md](ADDING-TOOLS.md).
- New method handler: add to `handlers` in `server.mjs`.
- New MCP capability: advertise it in the `initialize` reply as well as implementing it —
  a capability the client was not told about is a capability it will not call.

## Non-goals

- Remote access. Loopback only.
- Managing Studio's lifecycle. The bridge attaches to what is already running.
- Rewriting Studio tool schemas.
