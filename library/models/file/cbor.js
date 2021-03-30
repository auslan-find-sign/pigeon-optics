/**
 * Provides filesystem IO, with a bunch of safety. This is an abstraction on top of module:models/file/raw providing cbor encoding and decoding
 * @module module:models/file/cbor
 */
const assert = require('assert')
const codec = require('../codec')
const { Readable } = require('stream')
exports.raw = require('./raw').instance({
  extension: '.cbor'
})

/** Read a cbor encoded object from a path inside the data directory configured in package.json/defaults/data
 * If the data is unreadable or corrupt, attempts to read backup instead, printing an error in the process, if that's missing
 * or broken too, you can expect an error to throw, otherwise the older version will be returned with the error printed
 * @param {string|string[]} path - relative path inside data directory the data is located at
 * @returns {object}
 * @async
 */
exports.read = async function (dataPath) {
  const buffer = await this.raw.read(dataPath)
  return codec.cbor.decode(buffer)
}

/** Create or update a cbor data file, creating a .backup file of the previous version in the process
 * @param {string|string[]} path - relative path inside data directory the data is located at
 * @param {object} data - cbor encodable object to store
 * @async
 */
exports.write = async function (dataPath, data) {
  assert(data !== null, 'data cannot be null')
  return await this.writeStream(dataPath, Readable.from([data]))
}

/**
 * Open a readable object stream to the underlying file
 * @param {string[]} path data path to file
 */
exports.readStream = async function (dataPath) {
  const rawStream = await this.raw.readStream(dataPath)
  return rawStream.pipe(codec.cbor.getDecodeStream())
}

/**
 * Write an object stream to the file
 * @param {string[]} path data path to file
 * @param {ReadableStream} data
 */
exports.writeStream = async function (dataPath, data) {
  const encoder = codec.cbor.getEncoderStream()
  return await this.raw.writeStream(dataPath, data.pipe(encoder))
}

/**
 * Callback required by most find methods.
 * @callback module:models/file/cbor.updateBlock
 * @async
 * @param {*} data Current value of the file, or undefined if the file doesn't exist
 * @returns {*} if return value isn't undefined, the file is updated with the new content
 */

/** for a dataPath, run a given [async] function, and if it returns something other than undefined,
 * rewrite the file with the new value. This call is queued nicely, so parallel updates to the same
 * file wont clobber each other, they'll happen sequentially.
 * If file doesn't exist, data argument to block function will be undefined, but you can create a
 * file by returning something!
 * @param {string[]} path - path to data that is to be read and maybe rewritten
 * @param {module:models/file/cbor.updateBlock} block
 */
exports.update = async function (dataPath, block) {
  await this.raw.update(dataPath, async (buf) => {
    const input = buf ? codec.cbor.decode(buf) : undefined
    const output = await block(input)
    if (output !== undefined) {
      return codec.cbor.encode(output)
    }
  })
}

/** Remove a cbor data file
 * @param {string|string[]} [path] - relative path inside data directory the data is located at
 * @async
 */
exports.delete = async function (dataPath = []) {
  return await this.raw.delete(dataPath)
}

/** Checks a given data path for an existing record, and returns true or false async
 * @param {string|string[]} [path] - relative path inside data directory
 * @returns {boolean}
 * @async
 */
exports.exists = async function (dataPath = []) {
  return await this.raw.exists(dataPath)
}

/** List all the records in a data path
 * @param {string[]} [path] - relative path inside data directory to a folder containing multiple records
 * @returns {string[]}
 * @async
 */
exports.iterate = async function * iterate (dataPath = []) {
  yield * this.raw.iterate(dataPath)
}

/** List all the folders in a data path
 * @param {string[]} [path] - relative path inside data directory to a folder containing multiple records
 * @returns {string[]}
 * @async
 */
exports.iterateFolders = async function * iterateFolders (dataPath = []) {
  yield * this.raw.iterateFolders(dataPath)
}

// create an instance scoped in to a rootPath
exports.instance = function ({ rootPath = [] }) {
  const instance = Object.create(exports)
  instance.raw = require('./raw').instance({ rootPath, extension: '.cbor' })
  return instance
}
