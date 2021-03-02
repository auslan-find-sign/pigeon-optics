// blob store is a thing for storing blobs or objects by hash
// used to store objects in datasets and lens outputs
// used to store attachments in attachment store
const raw = Object.create(require('./raw'))

// set file extension
raw.extension = '.blob'

// default codec just passes through buffers
// but this could be set to codec.cbor, codec.json, etc
exports.codec = {
  decode: (buffer) => Buffer.from(buffer),
  encode: (buffer) => Buffer.from(buffer)
}

// hash function that takes an input and makes a hash of it
exports.hash = async (input) => {
  throw new Error('Blob Storage hash function needs to be defined')
}

// default path
exports.rootPath = ['blobs']

// get path to hash file in real filesystem (for web server streaming or whatever)
exports.getPath = function (hash) {
  return raw.getPath([...this.rootPath, hash.toString('hex')])
}

/** read something from the hash
 * @param {Buffer[32]} hash - hash of object to read
 * @returns {*}
 * @async
 */
exports.read = async function (hash) {
  const data = await raw.read([...this.rootPath, hash.toString('hex')])
  return await this.codec.decode(data)
}

/** Create or update a cbor data file, creating a .backup file of the previous version in the process
 * @param {object} data - cbor encodable object to store
 * @returns {Buffer[32]} hash
 * @async
 */
exports.write = async function (data) {
  const [hash, encoded] = await Promise.all([this.hash(data), this.codec.encode(data)])
  const dataPath = [...this.rootPath, hash.toString('hex')]

  if (!await raw.exists(dataPath)) {
    await raw.write(dataPath, encoded)
  }
  return hash
}

/** Remove a cbor data file
 * @param {string|string[]} path - relative path inside data directory the data is located at
 * @async
 */
exports.delete = async function (hash) {
  return await raw.delete([...this.rootPath, hash.toString('hex')])
}

/** Checks a given data path for an existing record, and returns true or false async
 * @param {Buffer[32]} hash - hash of content to check if it's in the store
 * @returns {boolean}
 * @async
 */
exports.exists = async function (hash) {
  return await raw.exists([...this.rootPath, hash.toString('hex')])
}

/** List all the records in a data path
 * @param {string[]} path - relative path inside data directory to a folder containing multiple records
 * @returns {string[]}
 * @async
 */
exports.list = async function * list (dataPath) {
  for await (const name of raw.list(dataPath)) {
    yield Buffer.from(name, 'hex')
  }
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
    extension, rootPath, codec, hash
  })
}
