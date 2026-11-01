# Adding a tool

A custom tool is the reason this repo exists rather than a thin relay. Keep tools small,
single-purpose and explicit about their arguments.

## The contract

```js
{
  name: 'lower_snake_case',      // unique, listed first, may shadow a Studio tool
  title: 'Human Title',
  description: 'One or two sentences: what it does and when to use it.',
  inputSchema: { type: 'object', properties: {}, required: [] },  // JSON Schema
  async handler(ctx, args) { return { text: '…' } },
}
```

`handler` returns `{ text, isError? }`. `isError: true` tells the client the call failed and
`text` becomes the reason — use it for expected failures instead of throwing.

`ctx` is `{ bridge, log }`:

- `bridge.callTool(name, args)` — one Studio tool call; resolves `{ result }` or `{ error }`.
- `bridge.callMethod(method, params)` — any other JSON-RPC method.
- `bridge.listStudios()` — the studio listing.
- `log(...)` — stderr. Never write to stdout yourself.

## Rules

1. **Validate first.** Use `src/args.mjs`. A malformed call must never reach Studio.
2. **Declare `studio_id`** whenever the tool touches a Studio, and put it in `required`.
   It is also the routing field: keep it inside `arguments`.
3. **Expect `{ error }`.** A missing Studio, a timeout and a disconnect all resolve there,
   never as a thrown exception.
4. **Handle `result.isError`.** Studio answers failures inside a successful frame.
5. **Keep failures per item.** A batch tool reports a bad item and carries on; it does not
   blank the whole response.
6. **No silent fallbacks.** If something is missing, say so in the text.
7. **Batch.** Studio freezes while `execute_luau` runs; prefer one call over N.

## Template

`src/tools/inspect-many.mjs`:

```js
import { requireStringArray, requireStudioId } from '../args.mjs'
import { resultText } from '../protocol.mjs'

export const inspectMany = {
  name: 'inspect_many',
  title: 'Inspect Many Instances',
  description: 'Returns the properties of several instances in one call.',
  inputSchema: {
    type: 'object',
    properties: {
      paths: { type: 'array', items: { type: 'string' } },
      studio_id: { type: 'string' },
    },
    required: ['paths', 'studio_id'],
  },
  async handler({ bridge }, args) {
    const paths = requireStringArray(args.paths, 'paths')
    const studioId = requireStudioId(args)

    const blocks = []
    for (const path of paths) {
      const { result, error } = await bridge.callTool('inspect_instance', { path, studio_id: studioId })
      if (error) blocks.push(`### ${path}\nERROR: ${error.message}`)
      else blocks.push(`### ${path}\n${resultText(result)}`)
    }
    return { text: blocks.join('\n\n') }
  },
}
```

Then in `src/tools/index.mjs`:

```js
import { inspectMany } from './inspect-many.mjs'
export const customTools = [listStudios, scriptReadMany, inspectMany]
```

## Test it

1. Add a unit test in `tests/tools.test.mjs` and any validation case in `tests/args.test.mjs`.
2. `npm run ci` — must be green.
3. `npm run smoke` with Studio open, then call the tool once by hand.

## Writing a good description

The description is the model's whole instruction set for the tool. Say what it returns, not
just what it does, and name the units. "Reads several scripts and returns each under its
path" beats "read scripts". Mention a required pre-step when there is one.
