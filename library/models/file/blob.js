/**
 * blob store, stores buffers (or optionally encodeable objects) by their content hash
 * blob store is mainly used to store dataset objects, and attachments
 * Data is also run through brotli compression, because this file io tends to be used for
 * very compressable objects, resulting in a 2-5x storage saving. Hash is of the original
 * uncompressed content
 * @module module:models/file/blob
 * @see module:models/file/raw
 */

const asyncIterableToArray = require('../../utility/async-iterable-to-array')
const HashThrough = require('hash-through')
const { PassThrough } = require('stream')
const fs = require('fs').promises
const crypto = require('crypto')
const zlib = require('zlib')

const BrotliOptions = {
  chunkSize: 32 * 1024,
  params: {
    [zlib.constants.BROTLI_PARAM_QUALITY]: zlib.constants.BROTLI_MIN_QUALITY,
    [zlib.constants.BROTLI_PARAM_MODE]: zlib.constants.BROTLI_MODE_GENERIC
  }
}

// used to store attachments in attachment store
exports.raw = require('./raw').instance({
  extension: '.blob.br'
})

// default codec just passes through buffers
// but this could be set to codec.cbor, codec.jsonLines, etc
exports.codec = {
  encode: (buffer) => Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer),
  decode: (buffer) => buffer,
  encoder: () => new PassThrough(),
  decoder: () => new PassThrough()
}

// hash function that takes an input and makes a hash of it
exports.getHashObject = function () {
  return crypto.createHash('sha256')
}

// get path to hash file in real filesystem (for web server streaming or whatever)
exports.getPath = function (hash) {
  return this.raw.getPath([hash.toString('hex')])
}

/** read something from the hash
 * @param {Buffer} hash - hash of object to read
 * @returns {*}
 * @async
 */
exports.read = async function (hash) {
  const rawStream = await this.raw.readStream([hash.toString('hex')])
  const decompressed = rawStream.pipe(zlib.createBrotliDecompress(BrotliOptions))
  const data = Buffer.concat(await asyncIterableToArray(decompressed))
  return await this.codec.decode(data)
}

/** Add a blob to the blob store, based on it's sha256 hash
 * @param {object} data - cbor encodable object to store
 * @returns {Buffer} hash
 * @async
 */
exports.write = async function (data) {
  const encoded = await this.codec.encode(data)
  const hasher = await this.getHashObject()
  hasher.update(encoded)
  const hash = hasher.digest()
  const dataPath = [hash.toString('hex')]

  if (!await this.raw.exists(dataPath)) {
    const brotli = zlib.createBrotliCompress(BrotliOptions)
    brotli.write(encoded)
    brotli.end()
    await this.raw.writeStream(dataPath, brotli)
  }
  return hash
}

/**
 * get a read stream of the content of a blob, decompressed and run through any codecs
 * @param {Buffer} hash - content hash
 * @returns {any}
 */
exports.readStream = async function (hash) {
  const rawStream = await this.raw.readStream([hash.toString('hex')])
  const decompress = rawStream.pipe(zlib.createBrotliDecompress(BrotliOptions))
  return decompress.pipe(this.codec.decoder())
}

/**
 * Add a blob to the store, and returns a hash of it's contents when it's finished
 * @param {Readable} stream
 * @returns {Buffer} hash
 * @async
 */
exports.writeStream = async function (stream) {
  const tempPath = [`blob-write-stream-temporary-${crypto.randomBytes(20).toString('hex')}`]
  const hasher = new HashThrough(this.getHashObject)
  const brotli = zlib.createBrotliCompress(BrotliOptions)
  await this.raw.writeStream(tempPath, stream.pipe(hasher).pipe(brotli))
  const hash = hasher.digest()
  const dataPath = [hash.toString('hex')]
  try {
    await this.raw.rename(tempPath, dataPath)
  } catch (err) {
    await this.raw.delete(tempPath)
  }
  return hash
}

/**
 * Import a blob from another blob storage instance, attempts to use hardlink to do it quick, falling back to copy otherwise
 * @param {import('./blob')} storage - blob storage instance
 * @param {string|Buffer} hash - content hash
 */
exports.import = async function (storage, hash) {
  const fspath = storage.getPath(hash)
  const target = this.getPath(hash)
  if (!await this.exists(hash)) {
    try {
      await fs.link(fspath, target)
    } catch (err) {
      // something didn't work about hardlinking, fallback to copying
      console.warn('hardlinking blob import failed:', err)
      console.warn('Copying streams instead')
      await this.writeStream(await storage.readStream(hash))
    }
  }
}

/** Remove a blob from the blob store by hash, or remove the entire folder of blobs
 * @param {string|Buffer} [hash] - hash of blob to delete. If undefined, deletes the whole folder and all the blobs, nuking the whole store
 * @async
 */
exports.delete = async function (hash) {
  if (hash) {
    return await this.raw.delete([hash.toString('hex')])
  } else {
    return await this.raw.delete([])
  }
}

/** Checks a given data path for an existing record, and returns true or false async
 * @param {Buffer} hash - hash of content to check if it's in the store
 * @returns {boolean}
 * @async
 */
exports.exists = async function (hash) {
  return await this.raw.exists([hash.toString('hex')])
}

/** Async Iterator of all the stored blob's hashes as buffers
 * @yields {Buffer}
 * @async
 */
exports.iterate = async function * () {
  for await (const name of this.raw.iterate()) {
    yield Buffer.from(name, 'hex')
  }
}

/** List all the records in a data path
 * @returns {string[]}
 * @async
 */
exports.list = async function () {
  return await asyncIterableToArray(this.iterate())
}

/** delete any blobs that aren't in the provided list, list can be any iterable of buffers
 * @param {string[]} list
 * @async
 */
exports.retain = async function (list) {
  const jobs = []
  const stringKeys = new Set([...list].map(x => x.toString('hex')))
  for await (const hash of this.iterate()) {
    if (!stringKeys.has(hash.toString('hex'))) {
      jobs.push(this.delete(hash))
    }
  }
  return await Promise.all(jobs)
}

/**
 * create an instance of blob store with settings configured
 * @param {object} config - config information to set defaults
 * @param {string} [config.extension] - set an extension, like '.data' or '.cbor'
 * @param {string[]} [config.rootPath] - set a dataPath to the folder which will contain the objects
 * @param {object} [config.codec] - set a codec like codec.json or codec.cbor, an object which has encode and decode methods
 * @param {function} [config.hash] - set a hash function, given a Buffer input returns a hash Buffer, can be async/promise returning
 * @returns {import('./blob')} - blob store instance, configured
 */
exports.instance = function ({
  extension = exports.extension,
  rootPath = exports.rootPath,
  codec = exports.codec,
  hash = exports.hash
}) {
  return Object.assign(Object.create(exports), {
    codec,
    hash,
    raw: require('./raw').instance({ rootPath, extension: `${extension}.br` })
  })
}
