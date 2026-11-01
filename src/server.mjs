#!/usr/bin/env node
/**
 * Entry point: MCP over stdio on one side, the Studio socket on the other.
 *
 * stdout carries protocol only. Everything else goes to stderr.
 */

import { createInterface } from 'node:readline'
import { ArgumentError, requireStudioId } from './args.mjs'
import { createBridge } from './bridge.mjs'
import { DEFAULT_PORT, resultText, studiosText, tokenFile } from './protocol.mjs'
import { asSchema, customTools, duplicateNames, findTool } from './tools/index.mjs'
import { VERSION } from './version.mjs'

const SERVER_INFO = { name: 'studio-direct-mcp', version: VERSION }
const INSTRUCTIONS = [
  'Custom MCP bridge to Roblox Studio.',
  'Start with list_roblox_studios and pass the chosen id as `studio_id` on every other call.',
  'execute_luau runs on the Studio main thread and freezes the editor until it yields:',
  'batch work and call task.wait() once per chunk.',
].join(' ')

const log = (...parts) => process.stderr.write(`[studio-direct-mcp] ${parts.join(' ')}\n`)
const write = (message) => process.stdout.write(JSON.stringify(message) + '\n')
const reply = (id, result) => write({ jsonrpc: '2.0', id, result })
const replyError = (id, code, message) => write({ jsonrpc: '2.0', id, error: { code, message } })

let studioTools = []

const bridge = createBridge({
  port: Number(process.env.MCP_PROXY_HTTP_PORT || DEFAULT_PORT),
  tokenPath: tokenFile(),
  log,
})

bridge.on('up', () => log('ready'))
bridge.on('tools', (tools) => {
  const first = studioTools.length === 0
  studioTools = tools
  if (!first) write({ jsonrpc: '2.0', method: 'notifications/tools/list_changed' })
  log(`studio tool catalog: ${studioTools.length}`)
})

const ctx = { bridge, log }

/** A custom tool, or a forwarded Studio tool. */
async function callTool(message) {
  const { id, params } = message
  const name = params?.name
  if (typeof name !== 'string') return replyError(id, -32602, '`params.name` is required.')

  const args = params.arguments ?? {}
  const custom = findTool(name)

  if (custom) {
    const outcome = await custom.handler(ctx, args)
    return reply(id, { content: [{ type: 'text', text: outcome.text }], isError: outcome.isError === true })
  }

  requireStudioId(args)
  const { result, error } = await bridge.callTool(name, args)
  if (error) return reply(id, { content: [{ type: 'text', text: error.message }], isError: true })
  reply(id, result)
}

const handlers = {
  initialize(message) {
    reply(message.id, {
      protocolVersion: message.params?.protocolVersion || '2025-06-18',
      capabilities: { tools: { listChanged: true } },
      serverInfo: SERVER_INFO,
      instructions: INSTRUCTIONS,
    })
  },
  ping(message) {
    reply(message.id, {})
  },
  'tools/list': (message) => reply(message.id, { tools: [...customTools.map(asSchema), ...studioTools] }),
  'tools/call': callTool,
  'resources/list': (message) => reply(message.id, { resources: [] }),
  'prompts/list': (message) => reply(message.id, { prompts: [] }),
}

async function dispatch(message) {
  const handler = handlers[message.method]
  if (!handler) return replyError(message.id, -32601, `Method not found: ${message.method}`)

  try {
    await handler(message)
  } catch (error) {
    if (error instanceof ArgumentError) return reply(message.id, { content: [{ type: 'text', text: error.message }], isError: true })
    log(`call failed: ${error.message}`)
    reply(message.id, { content: [{ type: 'text', text: error.message }], isError: true })
  }
}

function shutdown(code = 0) {
  bridge.close()
  process.exit(code)
}

process.on('SIGINT', () => shutdown())
process.on('SIGTERM', () => shutdown())

const dupes = duplicateNames(customTools)
if (dupes.length > 0) log(`duplicate tool names: ${dupes.join(', ')}`)

const stdin = createInterface({ input: process.stdin })
stdin.on('line', (line) => {
  const trimmed = line.trim()
  if (trimmed.length === 0) return

  let message
  try {
    message = JSON.parse(trimmed)
  } catch {
    return log('client sent invalid JSON')
  }

  if (typeof message.method === 'string' && message.method.startsWith('notifications/')) {
    if (message.method === 'notifications/cancelled') log('client cancelled', JSON.stringify(message.params ?? {}))
    return
  }
  void dispatch(message)
})
stdin.on('close', () => shutdown())

bridge.start()
log('started', `v${VERSION}`, `pid ${process.pid}`)
