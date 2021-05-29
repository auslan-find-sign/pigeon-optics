const cbor = require('cbor-x')
const { Readable, Transform } = require('stream')

exports.handles = ['application/cbor', 'application/x-cbor']
exports.extensions = ['cbor']
exports.decoderOpts = { structuredClone: false, useRecords: false, variableMapSize: true }
exports.encoderOpts = { structuredClone: false, useRecords: false, variableMapSize: true }

const enc = new cbor.Encoder(exports.encoderOpts)
const dec = new cbor.Decoder(exports.decoderOpts)

// extension to explicitly support Map - https://github.com/shanewholloway/js-cbor-codec/blob/master/docs/CBOR-259-spec--explicit-maps.md
// cbor.addExtension({
//   Class: Map,
//   tag: 259,
//   encode (instance, encode) {
//     encode(cbor.encode(instance))
//   },
//   decode (buffer) {
//     const data = cbor.decode(buffer)
//     if (data instanceof Map) return data
//     else return new Map(Object.entries(data))
//   }
// })

/**
 * Encodes a CBOR encodable object, with support for this application's Attachment and AttachmentReference objects
 * @param {any} data - arbitrary object to encode
 * @returns {Buffer} - cbor buffer
 */
exports.encode = function (data) {
  // return cbor.encode(data)
  return enc.encode(data)
}

/**
 * Decodes first item in buffer using CBOR, unpacking any attachments included in the cbor too
 * @param {Buffer} buffer - buffer containing cbor which optionally uses tag 27 object representation to include Attachment and AttachmentReference objects
 * @returns {any} - returns decoded object
 */
exports.decode = function (inputBuffer) {
  return dec.decode(inputBuffer)
}

const nullSymbol = Symbol.for('null')

/**
 * Create a transform stream which transforms a buffer stream in to an object stream using cbor streaming decoding
 * @param {object} [options]
 * @param {boolean} [wrap=false] - should values be formatted as { value: any } objects to support null values?
 * @returns {import('stream').Transform}
 */
exports.decoder = function ({ wrap = false } = {}) {
  // hack the decoder stream's push function to wrap nulls properly
  const decStream = new cbor.DecoderStream(exports.decoderOpts)
  const extended = Object.create(decStream)
  extended.push = (value) => decStream.push(wrap ? { value } : (value === null ? nullSymbol : value))
  decStream._transform = decStream._transform.bind(extended)
  // extend push with null encoding
  return decStream
}

/**
 * Create a transform stream which transforms a readable object stream to a binary encoded stream
 * @param {object} [options]
 * @param {boolean} [wrap=false] - should values be formatted as { value: any } objects to support null values?
 * @returns {Transform}
 */
exports.encoder = function ({ wrap = false } = {}) {
  return new Transform({
    writableObjectMode: true,
    readableObjectMode: false,
    transform (chunk, encoding, cb) {
      try {
        cb(null, exports.encode(wrap ? chunk.value : (chunk === nullSymbol ? null : chunk)))
      } catch (err) {
        cb(err)
      }
    }
  })
}

/**
 * Create a readable node buffer stream, from an iterable source
 * @param {Array|Iterable|IterableIterator|Generator|AsyncIterable|AsyncIterableIterator|AsyncGenerator}
 * @returns {Readable}
 */
exports.encodeIterable = function (iterable) {
  async function * gen (iter) {
    for await (const entry of iter) {
      yield exports.encode(entry)
    }
  }
  return Readable.from(gen(iterable))
}

// /**
//  * Create an async iterable from a node stream of buffers or any other [async] iterable source of buffers
//  * @param {Readable}
//  * @yields {any}
//  */
exports.decodeStream = async function * (readable) {
  for await (const obj of readable.pipe(exports.decoder())) {
    yield obj === nullSymbol ? null : obj
  }
}
