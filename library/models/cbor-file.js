const cbor = require('./codec').cbor
const fs = require('fs-extra')
const path = require('path')
const os = require('os')
const crypto = require('crypto')
const defaults = require('../../package.json').defaults

// normalise and check path for danger
function fullPath (dataPath, suffix = '.cbor') {
  if (`/${dataPath.join('/')}/`.includes('/../')) throw new Error('".." path segments aren\'t allowed for security')
  const jail = path.resolve(defaults.data)
  const segments = [defaults.data, dataPath].flat()
  const result = `${path.resolve(...segments)}${suffix}`
  if (!result.startsWith(jail)) throw new Error('path would escape data jail, nope!')
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
  const tryRead = async (dataPath) => {
    const buffer = await fs.readFile(fullPath(dataPath))
    return cbor.decode(buffer)
  }

  try {
    return await tryRead(dataPath)
  } catch (err) {
    console.error(`Data at path ${dataPath} unavailable: ${err}, trying .backup.cbor`)
    return await tryRead(`${dataPath}.backup`)
  }
}

/** Create or update a cbor data file, creating a .backup file of the previous version in the process
 * @param {string|string[]} path - relative path inside data directory the data is located at
 * @param {object} data - cbor encodable object to store
 * @async
 */
module.exports.write = async (dataPath, data) => {
  const path1 = fullPath(dataPath)
  const path2 = fullPath(dataPath, '.backup.cbor')
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
}

/** Remove a cbor data file
 * @param {string|string[]} path - relative path inside data directory the data is located at
 * @async
 */
module.exports.delete = async (dataPath) => {
  await fs.remove(fullPath(dataPath))
  await fs.remove(fullPath(dataPath, '.backup.cbor'))
}

/** Checks a given data path for an existing record, and returns true or false async
 * @param {string|string[]} path - relative path inside data directory
 * @returns {boolean}
 * @async
 */
module.exports.exists = async (dataPath) => {
  const results = await Promise.all([
    fs.pathExists(fullPath(dataPath)),
    fs.pathExists(fullPath(dataPath, '.backup.cbor'))
  ])

  return results.some(x => x === true)
}

/** List all the records in a data path
 * @param {string|string[]} path - relative path inside data directory to a folder containing multiple records
 * @returns {string[]}
 * @async
 */
module.exports.list = async (dataPath) => {
  let files
  try {
    files = await fs.readdir(path.join(defaults.data, dataPath))
    return files.filter(x => !x.endsWith('.backup.cbor')).map(x => x.replace(/\.cbor$/, ''))
  } catch (err) {
    if (err.code === 'ENOENT') {
      return []
    }
    throw err
  }
}
