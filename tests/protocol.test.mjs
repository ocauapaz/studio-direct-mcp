import test from 'node:test'
import assert from 'node:assert/strict'
import { control, jsonRpc, parseFrame, studiosText, studioIds, controlType, resultText } from '../src/protocol.mjs'

test('a control frame is recognised by its tag', () => {
  const parsed = parseFrame(JSON.stringify(control('pong')))
  assert.equal(parsed.kind, 'control')
  assert.equal(controlType(parsed.frame), 'pong')
})

test('a json-rpc frame keeps its members at the top level', () => {
  const frame = jsonRpc('tool-1', 'tools/call', { name: 'x', arguments: {} })
  assert.deepEqual(Object.keys(frame), ['type', 'jsonrpc', 'id', 'method', 'params'])
  assert.equal(parseFrame(JSON.stringify(frame)).kind, 'json_rpc')
})

test('padding a json-rpc frame under a message field is detectable', () => {
  const nested = { type: 'json_rpc', message: { id: 'a', method: 'ping' } }
  const parsed = parseFrame(JSON.stringify(nested))
  assert.equal(parsed.frame.id, undefined)
})

test('invalid input never throws', () => {
  assert.equal(parseFrame('not json').kind, 'invalid')
  assert.equal(parseFrame('[]').kind, 'invalid')
  assert.equal(parseFrame('{"type":"nope"}').kind, 'invalid')
})

test('missing control_type reads as null rather than undefined', () => {
  assert.equal(controlType({ type: 'control' }), null)
})

test('first text block is extracted and anything else is empty', () => {
  assert.equal(resultText({ content: [{ type: 'text', text: 'ok' }] }), 'ok')
  assert.equal(resultText({}), '')
  assert.equal(resultText(undefined), '')
})

test('a listing renders names and unnamed studios', () => {
  const text = studiosText([
    { id: 'a', name: 'Place (placeId: 1)' },
    { id: 'b', name: null },
  ])
  assert.match(text, /^a — Place/)
  assert.match(text, /\nb — \(unnamed\)$/)
})

test('an empty listing is a plain sentence, not a failure', () => {
  assert.equal(studiosText([]), 'No Roblox Studio instances are connected.')
  assert.deepEqual(studioIds([]), [])
})
