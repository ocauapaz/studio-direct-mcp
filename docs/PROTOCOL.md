# Protocol

Everything here was verified against a live Studio. Keep the shapes exact: the receiving
side accepts a wrong shape silently, so a mistake shows up as a call that never answers
rather than as a parse error.

## Transport

- One host process owns `127.0.0.1:$MCP_PROXY_HTTP_PORT` (default `13469`).
- Studio and every MCP bridge connect to it as clients. Studio does not listen.
- Frames are WebSocket text frames carrying JSON.
- No host means no port: the bridge keeps retrying until Studio's MCP server is enabled.

Two routes matter:

| Route | Purpose |
| --- | --- |
| `/proxy` | MCP clients (this server) |
| `/studio` | Studio registration |

`/health` answers a summary. Anything else is 404.

## Auth

- `Authorization: Bearer <token>`, token from `%LOCALAPPDATA%\Roblox\StudioMCP\auth.token`.
- Auth is checked before routing: any path without a valid token answers 401.
- Requests carrying a browser `Origin` are rejected.
- Two modes exist: `enforce` rejects a bad token, `observe` allows and logs it. A process
  that finds the port already taken does not host and drops to `observe`.

Read the token per connection; it can be rotated.

## Frame shape

A frame is one of two envelopes, discriminated by `type`.

Control:

```json
{ "type": "control", "control_type": "<variant>", "...": "variant fields" }
```

JSON-RPC:

```json
{ "type": "json_rpc", "jsonrpc": "2.0", "id": "tool-3", "method": "tools/call", "params": {} }
```

**The JSON-RPC members sit at the top level of the envelope.** Wrapping them under a
`message` or `payload` field parses fine and is then ignored — the usual first trap.

## Control variants

| `control_type` | Meaning |
| --- | --- |
| `tools_updated` | Tool catalog. Sent by the host, first frame on every connection. |
| `list_studios` | Ask which Studios are connected. Carries `request_id`. |
| `list_studios_response` | Answer, echoing `request_id`, with `studios`. |
| `pong` | Reply to a keepalive. |
| `proxy_hello` | Optional client announcement. |
| `client_connected` | Client reports it started talking MCP. |
| `pending_requests` | Outstanding request count telemetry. |

`list_studios` / `list_studios_response`:

```json
{ "type": "control", "control_type": "list_studios", "request_id": "ctrl-list-studios-1" }
{ "type": "control", "control_type": "list_studios_response", "request_id": "ctrl-list-studios-1",
  "studios": [ { "id": "6d0d0600-…", "name": "Place (placeId: 1)" } ] }
```

`name` may be `null` for a Studio with nothing loaded. An empty `studios` array is success.

## Opening handshake

1. Connect to `/proxy` with the bearer token.
2. **The host speaks first** with `tools_updated` and the full schema of every Studio tool
   (33 of them, cached host-side).
3. Send JSON-RPC frames. No greeting is required.

The catalog is re-broadcast when a Studio's tool set changes; treat a later
`tools_updated` as a refresh, not as an addition.

## Calling a tool

```json
{ "type": "json_rpc", "jsonrpc": "2.0", "id": "tool-7", "method": "tools/call",
  "params": { "name": "execute_luau",
              "arguments": { "studio_id": "9f2b6062-…", "datamodel_type": "Edit", "code": "return 1" } } }
```

`studio_id` lives in `arguments`. Putting it in `params`, or at the top of the envelope,
fails with:

> This call is missing the required `studio_id` argument. Call `list_roblox_studios` to get
> the connected instance ids, then include `studio_id` on every tool call.

An id that no Studio owns fails with `targeted studio <id> which is not connected`. With
several Studios open an omitted id is an error, never a guess.

Success and failure both come back on the same `id`, with the usual MCP result body
(`content` plus `isError`), not a JSON-RPC `error`:

```json
{ "type": "json_rpc", "jsonrpc": "2.0", "id": "tool-7",
  "result": { "content": [ { "type": "text", "text": "2" } ], "isError": false } }
```

Reserve a JSON-RPC `error` for transport-level faults.

## Framing rules that matter

- `id` must be a string, unique per connection, and echoed back. Ids are the only way a
  response finds its caller.
- A response with an `id` nobody waits for is dropped with a log line; it is not an error.
- `initialize`, `tools/list` and `ping` sent over `/proxy` are answered, but the real MCP
  `initialize` negotiation belongs to the client and the bridge, not to Studio. Only
  `tools/call` is forwarded.
- Control frames and JSON-RPC frames share one socket; neither may be assumed exclusive.

## Version notes

- Negotiated protocol version in practice: `2025-06-18`.
- Studio-side error strings mention `InputRequiredResult` requiring `2026-07-28` when used.
- Tool schemas are part of the catalog. Do not hand-write one for a Studio tool.
