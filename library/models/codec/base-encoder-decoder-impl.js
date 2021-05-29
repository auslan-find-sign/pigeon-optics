const { Readable, PassThrough } = require('stream')
const duplexify = require('duplexify')
const nullSymbol = Symbol.for('null')

function generatorToStream (gen, args, inputOptions, outputOptions, transformOptions) {
  const inputStream = new PassThrough(inputOptions)
  const outputStream = Readable.from(gen(inputStream, ...args), { outputOptions })
  const transformStream = duplexify(inputStream, outputStream, transformOptions)
  return transformStream
}

/**
 * given a readable stream
 * @param {AsyncIterable|AsyncIterableIterator|Iterable|IterableIterator} readable - Readable node-like object stream or iterator
 * @param {object} [options]
 * @param {boolean} [wrap = false] - are all values wrapped inside a { value } object?
 */
async function * unwrap (readable, { wrap = false } = {}) {
  if (wrap) {
    for await (const { value } of readable) yield value
  } else {
    for await (const value of readable) yield (value === nullSymbol ? null : value)
  }
}

/**
 * given a readable stream
 * @param {AsyncIterable|AsyncIterableIterator|Iterable|IterableIterator} readable - Readable node-like object stream or iterator
 * @param {object} [options]
 * @param {boolean} [wrap = false] - are all values wrapped inside a { value } object?
 */
async function * wrap (iterable, { wrap = false } = {}) {
  if (wrap) {
    for await (const value of iterable) yield { value }
  } else {
    for await (const value of iterable) yield (value === null ? nullSymbol : value)
  }
}

/**
 * Creates a Transform/Duplex stream, which encodes any objects written to it
 * @param {object} [options]
 * @param {boolean} [options.wrap = false] - input values are wrapped in a { value } object to better support null values
 * @returns {import('stream').Duplex}
 */
exports.encoder = function (...args) {
  const self = this
  const options = {
    wrap: false,
    ...args.find(x => x && typeof x === 'object' && !Array.isArray(x)) || {}
  }

  async function * gen (input, ...args) {
    yield * self.encodeIterable(unwrap(input, options), ...args)
  }

  return generatorToStream(gen, args, { objectMode: true }, { objectMode: false }, { writableObjectMode: true, readableObjectMode: false })
}

/**
 * Creates a Transform/Duplex stream, which decodes buffers in to a series of objects, optionally wrapped
 * @param {object} [options]
 * @param {boolean} [options.wrap = false] - input values are wrapped in a { value } object to better support null values
 * @returns {import('stream').Duplex}
 */

exports.decoder = function (...args) {
  const self = this
  const options = {
    wrap: false,
    ...args.find(x => x && typeof x === 'object' && !Array.isArray(x)) || {}
  }

  async function * gen (input, ...args) {
    yield * wrap(self.decodeStream(input, ...args), options)
  }

  return generatorToStream(gen, args, { objectMode: false }, { objectMode: true }, { writableObjectMode: false, readableObjectMode: true })
}
