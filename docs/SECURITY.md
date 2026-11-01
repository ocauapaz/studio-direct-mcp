# Security

## Boundary

The socket is loopback-only and authenticated. There is no remote path, so the threat model
is "something else already running on this machine" rather than the internet.

- Token: `%LOCALAPPDATA%\Roblox\StudioMCP\auth.token`, 64 hex characters, sent as a bearer
  header. Read it per connection — it rotates (see `FFlagStudioMCPProxyTokenRotate`).
- Requests with a browser `Origin` are rejected, so a web page cannot drive your editor
  through a stray fetch.
- Any path without a valid token answers 401, before routing.
- Auth modes: `enforce` rejects, `observe` allows and logs. A second process does not host
  and drops to `observe` — useful to know when you expect enforcement and get logging.

`STUDIO_MCP_TOKEN_FILE` overrides the token path.

## Blast radius

The token is not a permission scoped to one tool. Anything the token can reach, this server
can reach, including:

| Tool | Effect |
| --- | --- |
| `execute_luau` | Arbitrary Luau on the main thread — create, change, delete anything; can freeze Studio |
| `start_stop_play` | Enters and leaves play mode |
| `insert_asset`, `generate_*` | Writes into the place and the asset store |
| `upload_image`, `store_image` | Uploads to Roblox |
| `user_mouse_input`, `user_keyboard_input` | Drives the editor UI |
| `wait_job_finished` | Blocks on long generations |

`execute_luau` is flagged `destructiveHint: true` in its own schema. Nothing here adds an
undo step: **save before a large run**.

## Design decisions

**`studio_id` is always required.** With several Studios open, a call without one is an
error. Silent targeting is the failure mode that hurts — the call succeeds against the wrong
place.

**No automatic retry of tool calls.** A disconnect mid-`execute_luau` fails the call instead
of re-running it. Re-running is the caller's decision because the work may have half landed.

**Validate before forwarding.** `studio_id`, the types and the enums are checked in-process.
Cheap, and it keeps malformed traffic off the socket.

**No secrets in output.** The token never appears in a tool result or a log line.

**Failures stay loud.** A timeout, a close and a rejection each produce a distinct message.
There is no default value returned when the socket is down.

## Hardening checklist for a new deployment

- [ ] Token file readable only by your user account.
- [ ] Studio's MCP server enabled only while you are actually using it.
- [ ] Save the place before anything that runs a bulk `execute_luau`.
- [ ] Review any custom tool that takes a path or a Luau string from model output before
      you trust it on a real place.
- [ ] Keep `wait_job_finished` and generation tools out of an unattended loop unless the
      timeouts fit the job.

## What this server does not do

- No per-tool allowlist. If you need one, wrap `handlers['tools/call']`.
- No sandboxing of Luau: Studio runs it with full place access.
- No audit log file; failures go to stderr only.
