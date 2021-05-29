/**
 * Provides native v8 serialisation as a usable codec. Supposedly backwards compatible and safe for use
 * as disk storage, this format is really fast and able to represent a wide variety of object types well
 */
const v8 = require('v8')
const lps = require('length-prefixed-stream')
const { Readable, PassThrough } = require('stream')

// disabled due to uncertainty over safety deserializing untrusted content
// exports.handles = ['application/v8-serializer']
// exports.extensions = ['v8']

exports.encode = (value) => v8.serialize(value)
exports.decode = (buffer) => v8.deserialize(buffer)

const encImpl = require('./base-encoder-decoder-impl')
exports.encoder = encImpl.encoder.bind(exports)
exports.decoder = encImpl.decoder.bind(exports)

/**
 * Create a readable node buffer stream, from an iterable source
 * @param {Array|Iterable|IterableIterator|Generator|AsyncIterable|AsyncIterableIterator|AsyncGenerator}
 * @returns {Readable}
 */
exports.encodeIterable = function (iterable) {
  async function * generate (input) {
    for await (const value of input) yield v8.serialize(value)
  }
  const readable = Readable.from(generate(iterable), { objectMode: true })
  return readable.pipe(lps.encode()).pipe(new PassThrough({ objectMode: false }))
}

/**
 * Create an async iterable from a node stream of buffers or any other [async] iterable source of buffers
 * @param {Readable}
 * @yields {any}
 */
exports.decodeStream = async function * (readable) {
  for await (const value of readable.pipe(lps.decode()).pipe(new PassThrough({ objectMode: true }))) {
    yield v8.deserialize(value)
  }
}
