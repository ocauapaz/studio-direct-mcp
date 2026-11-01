/**
 * Argument validation. Every tool validates before a frame leaves the process, so a
 * malformed call fails with a message the caller can act on instead of a Studio error.
 */

export class ArgumentError extends Error {
  constructor(message) {
    super(message)
    this.name = 'ArgumentError'
  }
}

export function requireString(value, field) {
  if (typeof value !== 'string' || value.length === 0) {
    throw new ArgumentError(`\`${field}\` must be a non-empty string.`)
  }
  return value
}

export function requireStringArray(value, field) {
  if (!Array.isArray(value) || value.length === 0) {
    throw new ArgumentError(`\`${field}\` must be a non-empty array of strings.`)
  }
  for (const item of value) {
    if (typeof item !== 'string' || item.length === 0) {
      throw new ArgumentError(`\`${field}\` must contain only non-empty strings.`)
    }
  }
  return value
}

export function requireEnum(value, field, allowed) {
  if (!allowed.includes(value)) {
    throw new ArgumentError(`\`${field}\` must be one of: ${allowed.join(', ')}.`)
  }
  return value
}

export const DATAMODEL_TYPES = ['Edit', 'Client', 'Server']

/**
 * `studio_id` is required on every forwarded call. A single connected studio is still
 * addressed explicitly so a second studio appearing mid-session cannot change the target.
 */
export function requireStudioId(args) {
  return requireString(args?.studio_id, 'studio_id')
}

/**
 * A copy of the caller's arguments. `studio_id` stays in place: the routing layer reads
 * it from there and Studio's own tool schemas declare it required.
 */
export function forwardableArgs(args) {
  return { ...(args ?? {}) }
}
