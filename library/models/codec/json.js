const json5 = require('json5')
const streams = require('stream')
const streamJson = require('stream-json')
const createHttpError = require('http-errors')
const type = require('type-detect')

exports.handles = ['application/json', 'text/json', 'application/feed+json']
exports.extensions = ['json']

const constants = {
  undefined: undefined,
  infinity: Infinity,
  '-infinity': -Infinity
}

/**
 * Encodes a JSON encodable object, with support for this application's Attachment and AttachmentReference objects
 * @param {any} data - arbitrary object to encode
 * @param {Number} spaces - how many spaces of indent to use, defaults 0 for no whitespace
 * @returns {string} - json string containing object with attachments suitably encoded
 */
exports.encode = function (object, spaces = 0) {
  return JSON.stringify(object, this.replacer, spaces)
}

exports.replacer = function (key, value) {
  const is = type(value)

  for (const label in constants) {
    if (value === constants[label]) {
      return { type: 'constant', data: label }
    }
  }

  if (is === 'number' && Number.isNaN(value)) {
    return { type: 'constant', data: 'NaN' }
  } else if (is === 'Set') {
    return { type: 'Set', data: [...value] }
  } else if (is === 'Map') {
    return { type: 'Map', data: [...value] }
  } else if (is === 'Date') {
    return { type: 'Date', data: value.valueOf() }
  } else if (is === 'URL') {
    return { type: 'URL', data: value.toString() }
  } else if (is === 'bigint') {
    return { type: 'BigInteger', data: `${value}` }
  }
  return value
}

/**
 * Decodes first item in buffer using JSON, unpacking any attachments included in the cbor too
 * @param {string} jsonString - string containing json which optionally includes NodeJS stringified Buffers
 * @returns {any} - returns decoded object
 */
exports.decode = function (jsonString) {
  try {
    if (Buffer.isBuffer(jsonString)) jsonString = jsonString.toString('utf-8')
    return JSON.parse(jsonString, this.reviver)
  } catch (err) {
    return json5.parse(jsonString, this.reviver)
  }
}

exports.reviver = function (key, value) {
  if (value && typeof value === 'object' && Object.keys(value).length === 2 && 'data' in value && 'type' in value) {
    if (value.type === 'Buffer' && Array.isArray(value.data) && value.data.every(x => typeof x === 'number' && x >= 0 && x <= 255)) {
      return Buffer.from(value)
    } else if (value.type === 'Set' && Array.isArray(value.data)) {
      return new Set(value.data)
    } else if (value.type === 'Map' && Array.isArray(value.data)) {
      return new Map(value.data)
    } else if (value.type === 'Date' && typeof value.data === 'number') {
      return new Date(value.data)
    } else if (value.type === 'URL' && typeof value.data === 'string') {
      return new URL(value.data)
    } else if (value.type === 'BigInteger' && typeof value.data === 'string') {
      return BigInt(value.data)
    } else if (value.type === 'constant' && value.data === 'NaN') {
      return NaN
    } else if (value.type === 'constant' && value.data in constants) {
      return constants[value.data]
    }
  }
  return value
}

/**
 * Pretty prints an object using json5, with Attachments encoded in json format
 * @param {any} data - arbitrary object to encode
 * @param {Number} spaces - how many spaces of indent to use, defaults 0 for no whitespace
 * @returns {string} - json string containing object with attachments suitably encoded
 */
exports.print = function (object, spaces = 2) {
  return json5.stringify(object, this.replacer, spaces)
}

const encImpl = require('./base-encoder-decoder-impl')
exports.encoder = encImpl.encoder.bind(exports)
exports.decoder = encImpl.decoder.bind(exports)

/**
 * Create a transform stream, which takes in objects, and encodes them in to a streaming json array
 * @param {AsyncIterable|AsyncIterableIterator|Iterable|IterableIterator} iter
 * @param {object} [options]
 * @param {boolean} [options.object = false] - stream chunks must be a [key, value] entry, and a json object is streamed out, otherwise an array is streamed
 * @returns {streams.Readable}
 */
exports.encodeIterable = function encodeIterable (iter, { object = false } = {}) {
  const self = this
  async function * generate () {
    let first = true
    for await (const value of iter) {
      if (object) {
        if (first) yield Buffer.from(`{\n  ${self.encode(value[0])}:${self.encode(value[1])}`, 'utf-8')
        else yield Buffer.from(`,\n  ${self.encode(value[0])}:${self.encode(value[1])}`, 'utf-8')
      } else {
        if (first) yield Buffer.from(`[\n  ${self.encode(value)}`, 'utf-8')
        else yield Buffer.from(`,\n  ${self.encode(value)}`, 'utf-8')
      }
      first = false
    }
    if (object) yield Buffer.from('\n}\n', 'utf-8')
    else yield Buffer.from('\n]\n', 'utf-8')
  }

  return streams.Readable.from(generate(), { objectMode: false })
}

/**
 * Create a transform stream which decodes a JSON in to a stream of objects, the root must be an Array or an Object
 * Root arrays will result in an array, root objects will result in entries-like outputs [key, value] as each root
 * property is parsed
 * @param {streams.Readable} readable - input stream
 * @returns {streams.Transform}
 */
exports.decodeStream = async function * decodeStream (readable) {
  let started = false
  const stack = []
  const keyStack = []
  const self = this

  for await (const { name, value } of readable.pipe(streamJson.parser({ packValues: true, streamValues: false }))) {
    function * append (value) {
      if (stack.length > 0) {
        if (Array.isArray(stack[0])) {
          stack[0].push(self.reviver('', value))
        } else {
          const key = keyStack.shift()
          stack[0][key] = self.reviver(key, value)
        }
      } else {
        if (started === 'array') {
          yield self.reviver('', value)
        } else if (started === 'object') {
          const key = keyStack.shift()
          yield [key, self.reviver(key, value)]
        }
      }
    }

    if (!started) {
      if (name === 'startArray') {
        started = 'array'
      } else if (name === 'startObject') {
        started = 'object'
      } else {
        throw createHttpError(400, 'root object must be an Array or Object')
      }
    } else {
      if (name === 'numberValue') {
        yield * append(JSON.parse(value))
      } else if (name === 'stringValue') {
        yield * append(value)
      } else if (name === 'trueValue') {
        yield * append(true)
      } else if (name === 'falseValue') {
        yield * append(false)
      } else if (name === 'nullValue') {
        yield * append(null)
      } else if (name === 'keyValue') {
        keyStack.unshift(value)
      } else if (name === 'startObject') {
        stack.unshift({})
      } else if (name === 'startArray') {
        stack.unshift([])
      } else if (name === 'endObject' || name === 'endArray') {
        if (stack.length > 0) yield * append(stack.shift())
      }
    }
  }
}
