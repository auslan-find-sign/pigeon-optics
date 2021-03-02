const codec = require('../codec')
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
  const data = await this.raw.read(dataPath)
  return codec.cbor.decode(data)
}

/** Create or update a cbor data file, creating a .backup file of the previous version in the process
 * @param {string|string[]} path - relative path inside data directory the data is located at
 * @param {object} data - cbor encodable object to store
 * @async
 */
exports.write = async function (dataPath, data) {
  return await this.raw.write(dataPath, codec.cbor.encode(data))
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
exports.list = async function * list (dataPath = []) {
  for await (const name of this.raw.list(dataPath)) {
    yield name
  }
}

/** List all the folders in a data path
 * @param {string[]} [path] - relative path inside data directory to a folder containing multiple records
 * @returns {string[]}
 * @async
 */
exports.listFolders = async function * list (dataPath = []) {
  for await (const name of this.raw.listFolders(dataPath)) {
    yield name
  }
}

// create an instance scoped in to a rootPath
exports.instance = function ({ rootPath = [] }) {
  const instance = Object.create(exports)
  instance.raw = require('./raw').instance({ rootPath, extension: '.cbor' })
  return instance
}
