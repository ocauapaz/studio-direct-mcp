/**
 * Custom tool registry.
 *
 * Every entry is `{ name, title, description, inputSchema, handler(ctx, args) }` and is
 * listed ahead of the Studio's own tools. Add a file here, import it into the array
 * below, and the server picks it up; nothing else needs to change.
 */

import { listStudios } from './studios.mjs'
import { scriptReadMany } from './scripts.mjs'

export const customTools = [listStudios, scriptReadMany]

export function findTool(name) {
  return customTools.find((tool) => tool.name === name)
}

/** A tool schema without its handler, as `tools/list` must return it. */
export function asSchema(tool) {
  const { handler: _handler, ...schema } = tool
  return schema
}

export function duplicateNames(tools) {
  const seen = new Set()
  const dupes = new Set()
  for (const tool of tools) {
    if (seen.has(tool.name)) dupes.add(tool.name)
    seen.add(tool.name)
  }
  return [...dupes]
}
