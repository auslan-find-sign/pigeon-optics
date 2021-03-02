// blob store is a thing for storing blobs or objects by hash
// used to store objects in datasets and lens outputs
const asyncIterableToArray = require('../../utility/async-iterable-to-array')

// used to store attachments in attachment store
exports.raw = require('./raw').instance({
  extension: '.blob'
})

// default codec just passes through buffers
// but this could be set to codec.cbor, codec.json, etc
exports.codec = {
  decode: (buffer) => Buffer.from(buffer),
  encode: (buffer) => Buffer.from(buffer)
}

// hash function that takes an input and makes a hash of it
exports.hash = async (input) => {
  const crypto = require('crypto')
  const digester = crypto.createHash('sha256')
  digester.update(input)
  return digester.digest()
}

// get path to hash file in real filesystem (for web server streaming or whatever)
exports.getPath = function (hash) {
  return this.raw.getPath([hash.toString('hex')])
}

/** read something from the hash
 * @param {Buffer[32]} hash - hash of object to read
 * @returns {*}
 * @async
 */
exports.read = async function (hash) {
  const data = await this.raw.read([hash.toString('hex')])
  return await this.codec.decode(data)
}

/** Create or update a cbor data file, creating a .backup file of the previous version in the process
 * @param {object} data - cbor encodable object to store
 * @returns {Buffer[32]} hash
 * @async
 */
exports.write = async function (data) {
  const encoded = await this.codec.encode(data)
  const hash = await this.hash(encoded)
  const dataPath = [hash.toString('hex')]

  if (!await this.raw.exists(dataPath)) {
    await this.raw.write(dataPath, encoded)
  }
  return hash
}

/** Remove a cbor data file
 * @param {string|string[]} path - relative path inside data directory the data is located at
 * @async
 */
exports.delete = async function (hash) {
  return await this.raw.delete([hash.toString('hex')])
}

/** Checks a given data path for an existing record, and returns true or false async
 * @param {Buffer[32]} hash - hash of content to check if it's in the store
 * @returns {boolean}
 * @async
 */
exports.exists = async function (hash) {
  return await this.raw.exists([hash.toString('hex')])
}

/** Async Iterator of all the stored blob's hashes as buffers
 * @yields {Buffer[32]}
 * @async
 */
exports.iterate = async function * () {
  for await (const name of this.raw.list()) {
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

/** create an instance of blob store with settings configured
 * @returns {object} - blob store instance, configured
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
    raw: require('./raw').instance({ rootPath, extension })
  })
}
