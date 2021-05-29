const { Readable } = require('stream')
const msgpack = require('msgpack5')()

exports.handles = ['application/msgpack', 'application/x-msgpack']
exports.extensions = ['msgpack']

function replacer (input) {
  if (input === undefined) {
    return { type: 'constant', data: 'undefined' }
  } else if (Array.isArray(input)) {
    return input.map(replacer)
  } else if (input instanceof Map) {
    return new Map([...input.entries()].map(kv => kv.map(replacer)))
  } else if (input instanceof Set) {
    return new Set([...input].map(replacer))
  } else if (Buffer.isBuffer(input)) {
    return input
  } else if (input && typeof input === 'object') {
    if (Object.keys(input).sort().join(',') === 'data,type') {
      return { type: `!${input.type}`, data: input.data }
    } else {
      const entries = Object.entries(input).map(x => x.map(replacer))
      return Object.fromEntries(entries)
    }
  }
  return input
}

function reviver (input) {
  if (input && typeof input === 'object' && Object.keys(input).length === 2 && typeof input.type === 'string' && typeof input.data === 'string') {
    if (input.type === 'constant' && input.data === 'undefined') {
      return undefined
    } else if (typeof input.type === 'string' && input.type.startsWith('!')) {
      return { ...input, type: input.type.slice(1) }
    }
  } else if (Array.isArray(input)) {
    input.forEach((val, idx, arr) => { arr[idx] = reviver(val) })
  } else if (input instanceof Map) {
    input.forEach((val, key, map) => map.set(key, reviver(val)))
  } else if (input instanceof Set) {
    return new Set([...input].map(x => reviver(x)))
  } else if (input && typeof input === 'object') {
    Object.entries(input).forEach(([key, value]) => {
      input[key] = reviver(value)
    })
  }
  return input
}

exports.encode = function (input) {
  return msgpack.encode(replacer(input))
}

exports.decode = function (buffer) {
  return reviver(msgpack.decode(buffer))
}

const encImpl = require('./base-encoder-decoder-impl')
exports.encoder = encImpl.encoder.bind(exports)
exports.decoder = encImpl.decoder.bind(exports)

// hash a name in to an id number between 0 and 128, to use as an extension point type number
function nameToExtID (name) {
  return 1 + Array.prototype.reduce.call(name, (a, b) => a + parseInt(b, 36), 0) % 127
}

const setTypeNumber = nameToExtID('set') // 72
// Set's are encoded to an extension, which contains a messagepack encoded array of the set's elements
msgpack.register(setTypeNumber, Set, set => exports.encode([...set]), buffer => new Set(exports.decode(buffer)))

/**
 * Create a readable node buffer stream, from an iterable source
 * @param {Array|Iterable|IterableIterator|Generator|AsyncIterable|AsyncIterableIterator|AsyncGenerator}
 * @returns {Readable}
 */
exports.encodeIterable = function (iterable) {
  async function * generate (input) {
    for await (const value of input) yield exports.encode(value)
  }
  return Readable.from(generate(iterable))
}

/**
 * Create an async iterable from a node stream of buffers or any other [async] iterable source of buffers
 * @param {Readable}
 * @yields {any}
 */
exports.decodeStream = async function * (readable) {
  for await (const { value } of readable.pipe(msgpack.decoder({ wrap: true }))) {
    yield reviver(value)
  }
}
