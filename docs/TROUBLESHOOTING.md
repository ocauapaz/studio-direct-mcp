# Troubleshooting

Start by reading stderr. Every failure has its own line and none are swallowed.

## `rejected 401 … check the token file`

The header never reached an accepting host.

- Token file missing or stale → the host may have rotated it. Re-read from
  `%LOCALAPPDATA%\Roblox\StudioMCP\auth.token`.
- The token is only written while a host exists. If the file is absent, nothing is hosting.

## `socket error ECONNREFUSED` and endless `reconnecting in …`

No host on the port.

1. Is Studio open on a place?
2. Is the MCP server enabled in **Assistant settings**?
3. Did an earlier Studio quit and take the host with it? Reload the place.

The bridge backs off to 10 s and never gives up, so it recovers on its own once a host exists.

## A call never answers

Wrong frame shape. The receiving side accepts a nested payload and ignores it. Check
`docs/PROTOCOL.md`: the JSON-RPC members belong at the **top level**, not under `message`.

## `This call is missing the required studio_id argument`

`studio_id` must be in `arguments`, not in `params` and not at the top of the envelope.
`list_roblox_studios` gives you the ids.

## `targeted studio <id> which is not connected`

That Studio closed or reloaded. List again; ids are per session.

## `no response after 600000ms`

One call exceeded the tool timeout — usually a `execute_luau` that never yields. Split the
work and `task.wait()` once per chunk. See `src/server.mjs` instructions.

## `bridge disconnected: socket closed`

The socket dropped mid-call. The call is **not** retried. Re-run it if the work did not land;
check the place for a partial result first.

## Studio freezes while a call runs

Expected: `execute_luau` owns the main thread until it yields. Keep chunks small.

## `unhandled control frame` in the log

A control variant this build does not model. Harmless unless the variant changes behaviour
you depend on — then add it in `bridge.mjs` and `protocol.mjs`.

## Tests

```powershell
npm run ci               # syntax + unit, no Studio
node scripts/smoke.mjs   # live, needs Studio
```

A unit test that needs a socket is a unit test that will flake. Keep the split: pure layers
in `tests/`, the contract with Studio in the smoke script.
