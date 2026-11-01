/**
 * Envelope shapes for the Studio local interface.
 *
 * A frame is one of two things:
 *   { type: "control", control_type: <variant>, ...fields }
 *   { type: "json_rpc", jsonrpc: "2.0", id, method, params }
 *
 * The JSON-RPC members are flattened into the envelope. Wrapping them under a
 * `message` field is accepted by a parser and then ignored, so any nesting is a bug.
 *
 * `studio_id` is not an envelope field either: it is an ordinary, schema-required
 * *tool argument* and belongs in `params.arguments`.
 */

import { homedir } from 'node:os'
import { join } from 'node:path'

export const DEFAULT_PORT = 13469
export const CONTROL = 'control'
export const JSON_RPC = 'json_rpc'

/** Reverse-DNS-ish names the client side uses for control traffic. */
export const CTRL = {
  hello: 'proxy_hello',
  toolsUpdated: 'tools_updated',
  pong: 'pong',
  clientConnected: 'client_connected',
  pendingRequests: 'pending_requests',
  listStudios: 'list_studios',
  listStudiosResponse: 'list_studios_response',
}

export function control(controlType, fields = {}) {
  return { type: CONTROL, control_type: controlType, ...fields }
}

export function jsonRpc(id, method, params) {
  const frame = { type: JSON_RPC, jsonrpc: '2.0', id, method }
  if (params !== undefined) frame.params = params
  return frame
}

export function toolsCall(id, name, args) {
  return jsonRpc(id, 'tools/call', { name, arguments: args })
}

export function parseFrame(text) {
  let value
  try {
    value = JSON.parse(text)
  } catch {
    return { kind: 'invalid', reason: 'not JSON' }
  }
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return { kind: 'invalid', reason: 'not an object' }
  }
  if (value.type === CONTROL) return { kind: CONTROL, frame: value }
  if (value.type === JSON_RPC) return { kind: JSON_RPC, frame: value }
  return { kind: 'invalid', reason: `unknown type ${JSON.stringify(value.type)}` }
}

/** A control frame's variant name, or null when it carries none. */
export function controlType(frame) {
  const value = frame?.control_type
  return typeof value === 'string' ? value : null
}

/** True when a tools/call result is a failure flagged by the server. */
export function isErrorResult(result) {
  return result?.isError === true
}

/** First text block of a call result, or an empty string. */
export function resultText(result) {
  const block = Array.isArray(result?.content) ? result.content[0] : undefined
  return typeof block?.text === 'string' ? block.text : ''
}

/** Renders a studio listing; an empty listing is a normal, non-error outcome. */
export function studiosText(studios) {
  if (studios.length === 0) return 'No Roblox Studio instances are connected.'
  return studios
    .map((studio) => `${studio.id}${studio.name ? ` — ${studio.name}` : ' — (unnamed)'}`)
    .join('\n')
}

/** Splits a listing back into ids, in order. */
export function studioIds(studios) {
  return studios.map((studio) => studio.id)
}

export function tokenFile(platform = process.platform, env = process.env) {
  if (env.STUDIO_MCP_TOKEN_FILE) return env.STUDIO_MCP_TOKEN_FILE
  const base = platform === 'win32' ? env.LOCALAPPDATA : join(homedir(), '.local', 'share')
  return platform === 'win32'
    ? join(base, 'Roblox', 'StudioMCP', 'auth.token')
    : join(base, 'Roblox', 'StudioMCP', 'auth.token')
}

export function proxyUrl(port = DEFAULT_PORT) {
  return `ws://127.0.0.1:${port}/proxy`
}
