/**
 * The socket to the Studio host.
 *
 * Owns exactly one concern: moving frames in and out, keeping the connection alive, and
 * failing loudly when it cannot. Tool policy lives in `tools/`, protocol shapes in
 * `protocol.mjs`.
 */

import { EventEmitter } from 'node:events'
import { readFileSync } from 'node:fs'
import WebSocket from 'ws'
import { CTRL, control, parseFrame, proxyUrl, controlType } from './protocol.mjs'

const TOOL_TIMEOUT_MS = Number(process.env.STUDIO_MCP_TOOL_TIMEOUT_MS || 600000)
const CONTROL_TIMEOUT_MS = Number(process.env.STUDIO_MCP_CONTROL_TIMEOUT_MS || 15000)
const RECONNECT_MIN_MS = 500
const RECONNECT_MAX_MS = 10000

export class Bridge extends EventEmitter {
  #ws = null
  #ready = false
  #closed = false
  #seq = 0
  #pending = new Map()
  #queued = []
  #backoff = RECONNECT_MIN_MS

  constructor({ url, readToken, log }) {
    super()
    this.url = url
    this.readToken = readToken
    this.log = log
  }

  get connected() {
    return this.#ready
  }

  start() {
    this.#open()
    return this
  }

  close() {
    this.#closed = true
    this.#ws?.close()
    for (const entry of this.#pending.values()) entry.reject(new Error('bridge closed'))
    this.#pending.clear()
  }

  #open() {
    if (this.#closed) return
    const token = this.readToken()
    const ws = new WebSocket(this.url, { headers: { Authorization: `Bearer ${token}` } })

    ws.on('open', () => {
      this.#ready = true
      this.#backoff = RECONNECT_MIN_MS
      this.log('connected', this.url)
      for (const run of this.#queued.splice(0)) run()
      this.emit('up')
    })

    ws.on('message', (raw) => this.#onFrame(raw.toString()))

    ws.on('close', (code, reason) => {
      this.#ready = false
      this.log('socket closed', code, reason.toString() || '-')
      this.#failPending('socket closed')
      if (!this.#closed) this.#scheduleReconnect()
    })

    ws.on('error', (error) => this.log('socket error', error.message))

    ws.on('unexpected-response', (_req, res) => {
      this.log('rejected', res.statusCode, 'check the token file and that a Studio host is running')
    })

    this.#ws = ws
  }

  #scheduleReconnect() {
    const delay = this.#backoff
    this.#backoff = Math.min(this.#backoff * 2, RECONNECT_MAX_MS)
    this.log(`reconnecting in ${delay}ms`)
    setTimeout(() => this.#open(), delay)
  }

  #failPending(reason) {
    for (const entry of this.#pending.values()) {
      clearTimeout(entry.timer)
      entry.reject(new Error(`bridge disconnected: ${reason}`))
    }
    this.#pending.clear()
  }

  #onFrame(text) {
    const parsed = parseFrame(text)
    if (parsed.kind === 'invalid') return this.log('unparsable frame:', parsed.reason)

    if (parsed.kind === 'control') {
      const variant = controlType(parsed.frame)
      if (variant === CTRL.toolsUpdated) return this.emit('tools', parsed.frame.tools ?? [])
      if (variant === CTRL.pong) return
      if (variant === CTRL.listStudiosResponse) return this.#settle(parsed.frame.request_id, { studios: parsed.frame.studios ?? [] })
      return this.log('unhandled control frame', variant ?? '(no control_type)')
    }

    const { id, result, error } = parsed.frame
    if (id === undefined || id === null) return
    this.#settle(id, error ? { error } : { result })
  }

  #settle(id, outcome) {
    const entry = this.#pending.get(id)
    if (!entry) return this.log('response for unknown id', id)
    this.#pending.delete(id)
    clearTimeout(entry.timer)
    entry.resolve(outcome)
  }

  #send(frame) {
    return new Promise((resolve) => {
      const run = () => {
        this.#ws.send(JSON.stringify(frame))
        resolve()
      }
      if (this.#ready) run()
      else this.#queued.push(run)
    })
  }

  #request(id, frame, timeoutMs) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.#pending.delete(id)
        reject(new Error(`no response after ${timeoutMs}ms (id ${id})`))
      }, timeoutMs)
      this.#pending.set(id, { resolve, reject, timer })
      this.#send(frame).catch(reject)
    })
  }

  nextId(prefix) {
    return `${prefix}-${++this.#seq}`
  }

  /** One JSON-RPC tool call, addressed to a studio by the arguments themselves. */
  callTool(name, args) {
    const id = this.nextId('tool')
    const frame = { type: 'json_rpc', jsonrpc: '2.0', id, method: 'tools/call', params: { name, arguments: args } }
    return this.#request(id, frame, TOOL_TIMEOUT_MS)
  }

  /** Any other JSON-RPC method, for tools that are not a `tools/call`. */
  callMethod(method, params) {
    const id = this.nextId('rpc')
    const frame = { type: 'json_rpc', jsonrpc: '2.0', id, method }
    if (params !== undefined) frame.params = params
    return this.#request(id, frame, TOOL_TIMEOUT_MS)
  }

  /** Connected studios. An empty list is success, not an error. */
  listStudios() {
    const requestId = this.nextId('ctrl-list-studios')
    return this.#request(requestId, control(CTRL.listStudios, { request_id: requestId }), CONTROL_TIMEOUT_MS)
  }
}

export function readTokenFile(path) {
  const value = readFileSync(path, 'utf8').trim()
  if (value.length === 0) throw new Error(`token file is empty: ${path}`)
  return value
}

export function createBridge({ port, tokenPath, log }) {
  return new Bridge({ url: proxyUrl(port), readToken: () => readTokenFile(tokenPath), log })
}
