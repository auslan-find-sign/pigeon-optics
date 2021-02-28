const cbor = require('./codec').cbor
const fs = require('fs-extra')
const path = require('path')
const os = require('os')
const crypto = require('crypto')
const settings = require('./settings')

// encodes a string to be a valid filename but not use meaningful characters like . or /
// takes a brutalist approach, using decodeURIComponent format, but encoding anything that isn't [a-zA-Z0-9-_]
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

/** Read a cbor encoded object from a path inside the data directory configured in package.json/defaults/data
 * If the data is unreadable or corrupt, attempts to read backup instead, printing an error in the process, if that's missing
 * or broken too, you can expect an error to throw, otherwise the older version will be returned with the error printed
 * @param {string|string[]} path - relative path inside data directory the data is located at
 * @returns {object}
 * @async
 */
module.exports.read = async (dataPath) => {
  const tryRead = async (dataPath, ext) => {
    const buffer = await fs.readFile(fullPath(dataPath, ext))
    return cbor.decode(buffer)
  }

  try {
    return await tryRead(dataPath, '.cbor')
  } catch (err) {
    console.error(`Data at path ${dataPath} unavailable: ${err}, trying .cbor.backup`)
    return await tryRead(dataPath, '.cbor.backup')
  }
}

/** Create or update a cbor data file, creating a .backup file of the previous version in the process
 * @param {string|string[]} path - relative path inside data directory the data is located at
 * @param {object} data - cbor encodable object to store
 * @async
 */
module.exports.write = async (dataPath, data) => {
  const path1 = fullPath(dataPath, '.cbor')
  const path2 = fullPath(dataPath, '.cbor.backup')
  const encoded = cbor.encode(data)

  // ensure directory exists
  const folderPath = path.dirname(path1)
  await fs.ensureDir(folderPath)

  const rand = crypto.randomBytes(32).toString('hex')
  const tempPath = path.join(os.tmpdir(), `datasets-writing-${rand}.tmp.cbor`)
  await fs.writeFile(tempPath, encoded)

  // update backup with a copy of what was here previously if something old exists
  if (await fs.pathExists(path1)) {
    await fs.remove(path2)
    await fs.move(path1, path2)
  }

  await fs.move(tempPath, path1)
  await fs.remove(path2) // everything succeeded, we can erase the backup
}

/** Remove a cbor data file
 * @param {string|string[]} path - relative path inside data directory the data is located at
 * @async
 */
module.exports.delete = async (dataPath) => {
  await fs.remove(fullPath(dataPath, ''))
  await fs.remove(fullPath(dataPath, '.cbor'))
  await fs.remove(fullPath(dataPath, '.cbor.backup'))
}

/** Checks a given data path for an existing record, and returns true or false async
 * @param {string|string[]} path - relative path inside data directory
 * @returns {boolean}
 * @async
 */
module.exports.exists = async (dataPath) => {
  const results = await Promise.all([
    fs.pathExists(fullPath(dataPath)),
    fs.pathExists(fullPath(dataPath, '.cbor')),
    fs.pathExists(fullPath(dataPath, '.cbor.backup'))
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
      if (dirent.isFile() && dirent.name.endsWith('.cbor')) {
        yield decodePathSegment(dirent.name.replace(/\.cbor$/, ''))
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
