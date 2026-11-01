import test from 'node:test'
import assert from 'node:assert/strict'
import { ArgumentError, forwardableArgs, requireEnum, requireString, requireStringArray, requireStudioId } from '../src/args.mjs'

test('a non-empty string passes through', () => {
  assert.equal(requireString('x', 'f'), 'x')
})

test('empty, blank-typed and missing strings fail with the field name', () => {
  assert.throws(() => requireString('', 'paths'), ArgumentError)
  assert.throws(() => requireString(3, 'paths'), /`paths`/)
  assert.throws(() => requireString(undefined, 'paths'), ArgumentError)
})

test('a string array rejects an empty list and non-strings', () => {
  assert.deepEqual(requireStringArray(['a'], 'paths'), ['a'])
  assert.throws(() => requireStringArray([], 'paths'), ArgumentError)
  assert.throws(() => requireStringArray(['a', 2], 'paths'), ArgumentError)
  assert.throws(() => requireStringArray('a', 'paths'), ArgumentError)
})

test('an enum rejects a value outside the set', () => {
  assert.equal(requireEnum('Edit', 'datamodel_type', ['Edit', 'Client']), 'Edit')
  assert.throws(() => requireEnum('edit', 'datamodel_type', ['Edit', 'Client']), /must be one of/)
})

test('studio_id is required', () => {
  assert.equal(requireStudioId({ studio_id: 'a' }), 'a')
  assert.throws(() => requireStudioId({}), /`studio_id`/)
  assert.throws(() => requireStudioId(undefined), ArgumentError)
})

test('forwarded arguments keep studio_id and never alias the caller object', () => {
  const input = { studio_id: 'a', code: 'return 1' }
  const output = forwardableArgs(input)
  assert.equal(output.studio_id, 'a')
  assert.notEqual(output, input)
})
