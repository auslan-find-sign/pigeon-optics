const raw = Object.create(require('./raw'))
const codec = require('../codec')

// set file extension
raw.extension = '.cbor'

/** Read a cbor encoded object from a path inside the data directory configured in package.json/defaults/data
 * If the data is unreadable or corrupt, attempts to read backup instead, printing an error in the process, if that's missing
 * or broken too, you can expect an error to throw, otherwise the older version will be returned with the error printed
 * @param {string|string[]} path - relative path inside data directory the data is located at
 * @returns {object}
 * @async
 */
exports.read = async function (dataPath) {
  const data = await raw.read(dataPath)
  return codec.cbor.decode(data)
}

/** Create or update a cbor data file, creating a .backup file of the previous version in the process
 * @param {string|string[]} path - relative path inside data directory the data is located at
 * @param {object} data - cbor encodable object to store
 * @async
 */
exports.write = async function (dataPath, data) {
  return await raw.write(dataPath, codec.cbor.encode(data))
}

/** Remove a cbor data file
 * @param {string|string[]} path - relative path inside data directory the data is located at
 * @async
 */
exports.delete = async function (dataPath) {
  return await raw.delete(dataPath)
}

/** Checks a given data path for an existing record, and returns true or false async
 * @param {string|string[]} path - relative path inside data directory
 * @returns {boolean}
 * @async
 */
exports.exists = async function (dataPath) {
  return await raw.exists(dataPath)
}

/** List all the records in a data path
 * @param {string[]} path - relative path inside data directory to a folder containing multiple records
 * @returns {string[]}
 * @async
 */
exports.list = async function * list (dataPath) {
  for await (const name of raw.list(dataPath)) {
    yield name
  }
}

/** List all the folders in a data path
 * @param {string[]} path - relative path inside data directory to a folder containing multiple records
 * @returns {string[]}
 * @async
 */
exports.listFolders = async function * list (dataPath) {
  for await (const name of raw.listFolders(dataPath)) {
    yield name
  }
}
