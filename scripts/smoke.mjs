#!/usr/bin/env node
/**
 * Live smoke test. Needs a running Studio with the MCP server enabled.
 *
 * Speaks MCP to src/server.mjs over stdio, exactly as a client would, and checks the
 * four things that break first: initialize, tool listing, studio discovery, and a
 * real execute_luau round-trip. Exits non-zero on the first failure.
 */

import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { createInterface } from 'node:readline'

const FAIL = 'smoke failed: '
const child = spawn(process.execPath, ['src/server.mjs'], { stdio: ['pipe', 'pipe', 'inherit'] })
const lines = createInterface({ input: child.stdout })
const waiting = new Map()
let seq = 0

lines.on('line', (line) => {
  const message = JSON.parse(line)
  if (message.id !== undefined && waiting.has(message.id)) {
    waiting.get(message.id)(message)
    waiting.delete(message.id)
  }
})

function rpc(method, params) {
  const id = ++seq
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${FAIL}${method} timed out`)), 120000)
    waiting.set(id, (message) => {
      clearTimeout(timer)
      resolve(message)
    })
    child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n')
  })
}

const call = (name, args) => rpc('tools/call', { name, arguments: args })

function textOf(message) {
  return message.result?.content?.[0]?.text ?? ''
}

try {
  const init = await rpc('initialize', { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'smoke', version: '0' } })
  assert.equal(init.result.serverInfo.name, 'studio-direct-mcp')
  child.stdin.write(JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }) + '\n')
  console.log('ok initialize')

  const list = await rpc('tools/list', {})
  const names = list.result.tools.map((tool) => tool.name)
  assert.ok(names.includes('list_roblox_studios'))
  assert.ok(names.length > 2, 'studio tools should be listed')
  console.log(`ok tools/list (${names.length})`)

  const studios = await call('list_roblox_studios', {})
  assert.equal(studios.result.isError, false)
  const studioId = /^([0-9a-f-]{36})/m.exec(textOf(studios))?.[1]
  assert.ok(studioId, 'a studio id should be listed')
  console.log(`ok list_roblox_studios (${studioId})`)

  const missing = await call('execute_luau', { code: 'return 1', datamodel_type: 'Edit' })
  assert.equal(missing.result.isError, true)
  assert.match(textOf(missing), /studio_id/)
  console.log('ok missing studio_id is refused')

  const ran = await call('execute_luau', { studio_id: studioId, datamodel_type: 'Edit', code: 'return "smoke " .. tostring(1 + 1)' })
  assert.equal(ran.result.isError, false)
  assert.equal(textOf(ran), 'smoke 2')
  console.log('ok execute_luau')

  console.log('\nsmoke passed')
} catch (error) {
  console.error(error.message)
  process.exitCode = 1
} finally {
  child.kill()
}
