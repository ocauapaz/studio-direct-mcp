# agents

Rules for anyone — human or agent — changing this repo. They win over habit.

## Shape

- Three layers, one direction: `server.mjs` → `tools/` → `bridge.mjs` → socket.
  A tool never opens a socket; the bridge never knows a tool's name.
- `protocol.mjs` and `args.mjs` are pure. No I/O, no timers, no `process`.
- Keep `server.mjs` thin. If it grows a policy branch, that branch belongs in `tools/`.

## Protocol

- Read `docs/PROTOCOL.md` before editing `bridge.mjs` or `protocol.mjs`.
- JSON-RPC members go at the **top level** of the `json_rpc` envelope. Never nest them.
- `studio_id` is a required tool argument and the routing field. It goes in `arguments`.
- A wrong shape is accepted silently — prove a change with a real call, never by types alone.

## Tools

- One file per tool, one array entry in `src/tools/index.mjs`.
- Every tool: name, title, description, `inputSchema`, handler. No tool without all five.
- Validate with `src/args.mjs` before writing a frame.
- Declare `studio_id` in `required` for anything that touches a Studio.
- Handle `{ error }` and `result.isError`. Both are normal outcomes.
- Batch tools report a bad item and continue.
- Descriptions state what is returned and the units, not just what happens.

## Errors

- A fallback may not silence a failure. Distinct message per cause, to stderr, for the caller.
- Expected failures are values (`isError: true` + reason), not exceptions.
- No retry of a tool call on disconnect: the work may have half landed.
- Never log the token.

## Style

- ESM, `node:` builtins first, then packages, then local.
- Top-level `const` for configuration. No magic numbers in a function; name them.
- Small functions, plain data in and out, no class unless it holds state that must survive
  calls (`Bridge` is the only one).
- No new dependency without saying what it replaces.

## Testing

- `npm run ci` before any commit. Green or not finished.
- New validation → a case in `tests/args.test.mjs`. New tool → a case in `tests/tools.test.mjs`.
- Pure layers only in `tests/`. Anything needing Studio goes in `scripts/smoke.mjs`.
- A red check is a failure, never a skip. Report the error, do not re-label it flaky.

## Docs

- Behaviour change: update the doc that describes it in the same commit
  (`PROTOCOL.md`, `ARCHITECTURE.md`, `SECURITY.md`, `README.md`).
- A tool list in a doc must match `src/tools/index.mjs` exactly.

## Git

- Conventional Commits. One topic per commit.
- Stage explicit paths. Do not commit `node_modules/`, logs or tokens.

## Words

- Describe behaviour plainly: "the host speaks first", not "apparently" or "we believe".
- Do not credit an analysis method in docs; state what is true and how to check it.
  Verifiable facts, timings and exact strings only.
