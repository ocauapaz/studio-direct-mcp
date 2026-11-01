import test from 'node:test'
import assert from 'node:assert/strict'
import { asSchema, customTools, duplicateNames, findTool } from '../src/tools/index.mjs'

test('every custom tool is complete', () => {
  assert.ok(customTools.length > 0)
  for (const tool of customTools) {
    assert.match(tool.name, /^[a-z][a-z0-9_]*$/)
    assert.ok(tool.title.length > 0)
    assert.ok(tool.description.length > 0)
    assert.equal(tool.inputSchema.type, 'object')
    assert.equal(typeof tool.handler, 'function')
  }
})

test('custom names are unique', () => {
  assert.deepEqual(duplicateNames(customTools), [])
  assert.deepEqual(duplicateNames([{ name: 'a' }, { name: 'a' }]), ['a'])
})

test('a schema drops the handler', () => {
  const schema = asSchema(customTools[0])
  assert.equal(schema.handler, undefined)
  assert.equal(typeof customTools[0].handler, 'function')
})

test('lookup finds a tool and misses cleanly', () => {
  assert.equal(findTool('list_roblox_studios')?.name, 'list_roblox_studios')
  assert.equal(findTool('nope'), undefined)
})

test('studio listing needs no studio_id', () => {
  assert.deepEqual(findTool('list_roblox_studios').inputSchema.required, [])
})

test('forwarding tools declare studio_id as required', () => {
  for (const name of ['script_read_many']) {
    assert.ok(findTool(name).inputSchema.required.includes('studio_id'))
  }
})
