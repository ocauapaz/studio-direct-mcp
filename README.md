# studio-direct-mcp

A custom [MCP](https://modelcontextprotocol.io) server that drives **Roblox Studio directly**,
over the local socket Studio already exposes, with no proxy wrapper in between.

It is a bridge and a tool host: it lists the Studio instances open on this machine, forwards
tool calls to the one you pick, and adds tools of its own on top.

```
MCP client ──stdio──▶ studio-direct-mcp ──WebSocket──▶ 127.0.0.1:13469/proxy ──▶ Studio
```

Nothing here re-implements Studio. It speaks the same local interface Studio's own tooling
uses, so every Studio tool is available unchanged and the custom tools compose them.

## What you get

- Every Studio tool in the catalog, forwarded verbatim — `execute_luau`, `script_read`,
  `search_game_tree`, `inspect_instance`, `screen_capture`, asset and avatar tools, and the rest.
- `list_roblox_studios` — which instances are open, so a call never has to guess.
- `script_read_many` — many scripts per call instead of one.
- A place to put your own tools (see [docs/ADDING-TOOLS.md](docs/ADDING-TOOLS.md)).
- Reconnect, request timeouts, per-call validation and loud failures.

## Requirements

- Windows, Node **20+**, and Roblox Studio.
- Studio open on a place, with the MCP server enabled in **Assistant settings**.
  With no Studio there is no host to talk to and the bridge keeps retrying.

## Install

```powershell
git clone <this repo> && cd studio-direct-mcp
npm install
```

## Run it yourself

```powershell
npm start
```

It speaks MCP on stdout and logs on stderr. It is meant to be launched by a client, not typed at.

Live check against a running Studio:

```powershell
node scripts/smoke.mjs
```

## Connect a client

Point the client at `node <path>\src\server.mjs` (Windows: `cmd /c node ...`). See
[mcp.json.example](mcp.json.example).

```json
{
  "mcpServers": {
    "studio": {
      "command": "node",
      "args": ["E:\\studio-direct-mcp\\src\\server.mjs"]
    }
  }
}
```

Then:

1. `list_roblox_studios` → pick an id.
2. Pass it as `studio_id` on every other call.

`studio_id` is a plain tool argument and is **required**, even with a single Studio open:
if a second one opens mid-session, the target must not change under you.

## Custom tools

A tool is one object with a name, a schema and a handler. Drop a file in `src/tools/`, add it
to the array in `src/tools/index.mjs`. Full walkthrough and a template in
[docs/ADDING-TOOLS.md](docs/ADDING-TOOLS.md).

Custom tools are listed **before** Studio's tools, so a custom name always wins.

## How it fits together

| Path | Role |
| --- | --- |
| `src/server.mjs` | MCP over stdio: initialize, tool listing, dispatch, shutdown |
| `src/bridge.mjs` | the socket: auth header, reconnect, request/reply, timeouts |
| `src/protocol.mjs` | frame shapes, parsing, text rendering (pure) |
| `src/args.mjs` | argument validation (pure) |
| `src/tools/` | tool registry and custom tools |
| `docs/` | protocol, architecture, security, troubleshooting |

Recipes for the common shapes are in [docs/USAGE.md](docs/USAGE.md).

The wire protocol, in full, is in [docs/PROTOCOL.md](docs/PROTOCOL.md). Read it before touching
`bridge.mjs` or `protocol.mjs`.

## Safety in one paragraph

The socket is authenticated with a token file and only exists on loopback. Calls reach a real
editor: `execute_luau` can change or delete anything in the place, and it freezes Studio until
it yields. Batch work, and save before a big run. Details and the full blast-radius list in
[docs/SECURITY.md](docs/SECURITY.md).

## Develop

```powershell
npm run ci        # syntax check + unit tests, no Studio needed
npm run test      # unit tests only
node scripts/smoke.mjs   # live, needs Studio
```

Unit tests cover the pure layers only — validation, parsing, rendering, registry shape. The
contract with Studio is checked by the smoke test. When you change a tool, add or update a test
before the smoke run.

## Limits worth knowing up front

- One machine, local only. There is no remote mode.
- Studio must already be running with the MCP server enabled.
- `execute_luau` on a huge tree can drop the socket; the bridge reconnects, the call is lost.
- Responses are text for the model, not parsed objects. If you need structure, return JSON
  from your Luau and parse on the other side.

## License

MIT.
