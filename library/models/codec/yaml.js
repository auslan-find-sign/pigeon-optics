const yaml = require('yaml')
const { Readable, Transform } = require('stream')
const type = require('type-detect')

function reviver (key, value) {
  if (value && typeof value === 'object' && Object.keys(value).sort().join(',') === 'data,type') {
    if (value.type === 'Buffer' && typeof value.data === 'string') {
      return Buffer.from(value.data, 'hex')
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
    } else if (value.type === 'constant' && value.data === 'undefined') {
      return undefined
    }
  }
  return value
}

function replacer (key, value) {
  const is = type(value)

  if (value === undefined) {
    return { type: 'constant', data: 'undefined' }
  } else if (Buffer.isBuffer(value)) {
    return { type: 'Buffer', data: value.toString('hex') }
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

exports.handles = ['application/yaml', 'text/yaml', 'application/x-yaml', 'text/x-yaml']
exports.extensions = ['yaml', 'yml']

exports.decode = function (yamlString) {
  if (Buffer.isBuffer(yamlString)) yamlString = yamlString.toString('utf-8')
  return yaml.parse(yamlString, reviver)
}

exports.encode = function (object) {
  if (object === undefined) {
    return yaml.stringify(replacer(undefined, undefined))
  } else {
    return yaml.stringify(object, replacer)
  }
}

const encImpl = require('./base-encoder-decoder-impl')
exports.encoder = encImpl.encoder.bind(exports)
exports.decoder = encImpl.decoder.bind(exports)

exports.encodeIterable = function encodeIterable (iterator) {
  const self = this
  async function * gen () {
    for await (const entry of iterator) {
      yield Buffer.from(`${self.encode(entry)}...\n`, 'utf-8')
    }
  }
  return Readable.from(gen())
}

// speciality encoder for building xml flat file exports
exports.entriesEncoder = function entriesEncoder () {
  return new Transform({
    writableObjectMode: true,
    transform: (chunk, encoding, callback) => {
      const block = {
        id: chunk.id,
        version: chunk.version,
        hash: chunk.hash.toString('hex'),
        data: chunk.data
      }
      try { callback(null, `${this.encode(block)}...\n`) } catch (err) { callback(err) }
    }
  })
}

exports.decodeStream = async function * decodeStream (readable) {
  let buffer = Buffer.alloc(0)

  for await (const chunk of readable) {
    buffer = Buffer.concat([buffer, chunk])
    let offset
    while ((offset = buffer.indexOf('\n...')) >= 0) {
      // slice off the first document from the buffer
      const lineSlice = buffer.slice(0, offset + 1)
      const docText = lineSlice.toString('utf-8')
      buffer = buffer.slice(offset + 5)
      yield this.decode(docText)
    }
  }
}
