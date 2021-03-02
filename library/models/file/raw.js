const fs = require('fs-extra')
const path = require('path')
const os = require('os')
const settings = require('../settings')
const assert = require('assert')

// encodes a string to be a valid filename but not use meaningful characters like . or /
function encodePathSegment (string) {
  return encodeURIComponent(string).replace('.', '%2e')
}

function decodePathSegment (string) {
  return decodeURIComponent(string)
}

// normalise and check path for danger
function fullPath (dataPath, suffix = '') {
  const jail = path.resolve(settings.data)
  dataPath = [dataPath].flat().map(encodePathSegment)
  const segments = [settings.data, ...dataPath]
  const result = `${path.resolve(...segments)}${suffix}`
  if (!result.startsWith(jail)) throw new Error('path would escape data jail somehow, nope!')
  return result
}

exports.extension = '.data'

/** Read raw buffer of a file path path inside the data directory configured in package.json/defaults/data
 * If the data is unreadable or corrupt, attempts to read backup instead, printing an error in the process, if that's missing
 * or broken too, you can expect an error to throw, otherwise the older version will be returned with the error printed
 * @param {string|string[]} path - relative path inside data directory the data is located at
 * @returns {Buffer}
 * @async
 */
exports.read = async function (dataPath) {
  assert(Array.isArray(dataPath), 'dataPath must be an array of path segments')

  const tryRead = (dataPath, ext) => fs.readFile(fullPath(dataPath, ext))

  try {
    return await tryRead(dataPath, this.extension)
  } catch (err) {
    console.error(`Data at path ${dataPath} unavailable: ${err}, trying .backup`)
    return await tryRead(dataPath, `${this.extension}.backup`)
  }
}

exports.getPath = function (dataPath) {
  return fullPath(dataPath, this.extension)
}

/** Create or update a raw file, creating a .backup file of the previous version in the process
 * @param {string|string[]} path - relative path inside data directory the data is located at
 * @param {Buffer} data - cbor encodable object to store
 * @async
 */
exports.write = async function (dataPath, data) {
  assert(Array.isArray(dataPath), 'dataPath must be an array of path segments')
  assert(Buffer.isBuffer(data), 'data must be a Buffer instance')

  const path1 = fullPath(dataPath, this.extension)
  const path2 = fullPath(dataPath, `${this.extension}.backup`)

  // ensure directory exists
  const folderPath = path.dirname(path1)
  await fs.ensureDir(folderPath)

  const rand = `${Math.round(Math.random() * 0xFFFFFF)}-${Math.round(Math.random() * 0xFFFFFF)}`
  const tempPath = path.join(os.tmpdir(), `pigeon-optics-writing-${rand}${this.extension}`)
  await fs.writeFile(tempPath, data)

  // update backup with a copy of what was here previously if something old exists
  if (await fs.pathExists(path1)) {
    await fs.remove(path2)
    await fs.move(path1, path2)
  }

  await fs.move(tempPath, path1)
  await fs.remove(path2) // everything succeeded, we can erase the backup
}

/** Remove a raw file or directory
 * @param {string|string[]} path - relative path inside data directory the data is located at
 * @async
 */
exports.delete = async function (dataPath) {
  await fs.remove(fullPath(dataPath, this.extension))
  await fs.remove(fullPath(dataPath, `${this.extension}.backup`))
}

/** Checks a given data path for an existing record, and returns true or false async
 * @param {string|string[]} path - relative path inside data directory
 * @returns {boolean}
 * @async
 */
module.exports.exists = async function (dataPath) {
  const results = await Promise.all([
    fs.pathExists(fullPath(dataPath, '')),
    fs.pathExists(fullPath(dataPath, this.extension)),
    fs.pathExists(fullPath(dataPath, `${this.extension}.backup`))
  ])

  return results.some(x => x === true)
}

/** List all the records in a data path
 * @param {string[]} path - relative path inside data directory to a folder containing multiple records
 * @returns {string[]}
 * @async
 */
module.exports.list = async function * list (dataPath) {
  try {
    const dir = await fs.opendir(fullPath(dataPath))
    for await (const dirent of dir) {
      if (dirent.isFile() && dirent.name.endsWith(this.extension)) {
        yield decodePathSegment(dirent.name.slice(0, -this.extension.length))
      }
    }
  } catch (err) {
    if (err.code === 'ENOENT') {
      return
    }
    throw err
  }
}

/** List all the folders in a data path
 * @param {string[]} path - relative path inside data directory to a folder containing multiple records
 * @returns {string[]}
 * @async
 */
module.exports.listFolders = async function * list (dataPath) {
  try {
    const dir = await fs.opendir(fullPath(dataPath))
    for await (const dirent of dir) {
      if (dirent.isDirectory()) {
        yield decodePathSegment(dirent.name)
      }
    }
  } catch (err) {
    if (err.code !== 'ENOENT') { // if the data is just missing, silently ignore it yielding no entries
      throw err
    }
  }
}
