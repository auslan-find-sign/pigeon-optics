/**
 * Raw file IO abstraction. Provides raw files, with injection safe paths, and file anti-clobbering queue functionality
 * @module module:models/file/raw
 */
const fs = require('fs-extra')
const path = require('path')
const os = require('os')
const settings = require('../settings')
const assert = require('assert')
const { Readable } = require('stream')
const tq = require('tiny-function-queue')

// encodes a string to be a valid filename but not use meaningful characters like . or /
function encodePathSegment (string) {
  return encodeURIComponent(string).replace('.', '%2e')
}

function decodePathSegment (string) {
  return decodeURIComponent(string)
}

// normalise and check path for danger
exports.fullPath = function (dataPath, suffix = '') {
  const jail = path.resolve(settings.data)
  dataPath = [...this.rootPath, dataPath].flat().map(encodePathSegment)
  const segments = [settings.data, ...dataPath]
  const result = `${path.resolve(...segments)}${suffix}`
  if (!result.startsWith(jail)) throw new Error('path would escape data jail somehow, nope!')
  return result
}

exports.extension = '.data'
exports.rootPath = []

/**
 * Transform a PO dataPath to a local filesystem path
 * @param {string[]} path array of path segments
 * @returns {string} local filesystem path
 */
exports.getPath = function (dataPath) {
  return this.fullPath(dataPath, this.extension)
}

/**
 * Read raw buffer of a file path path inside the data directory configured in package.json/defaults/data
 * If the data is unreadable or corrupt, attempts to read backup instead, printing an error in the process, if that's missing
 * or broken too, you can expect an error to throw, otherwise the older version will be returned with the error printed
 * @param {string|string[]} path - relative path inside data directory the data is located at
 * @returns {Buffer}
 * @async
 */
exports.read = async function (dataPath) {
  assert(Array.isArray(dataPath), 'dataPath must be an array of path segments')

  const chunks = []
  const stream = await this.readStream(dataPath)
  for await (const chunk of stream) chunks.push(chunk)
  return Buffer.concat(chunks)
}

/** Create or update a raw file, creating a .backup file of the previous version in the process
 * @param {string[]} path - relative path inside data directory the data is located at
 * @param {Buffer} data - cbor encodable object to store
 * @async
 */
exports.write = async function (dataPath, data) {
  assert(Array.isArray(dataPath), 'dataPath must be an array of path segments')
  assert(Buffer.isBuffer(data), 'data must be a Buffer instance')

  return await this.writeStream(dataPath, Readable.from(data))
}

/**
 * Open a readable stream of the specified file
 * @param {string[]} path
 * @returns {fs.ReadStream}
 * @async
 */
exports.readStream = function (dataPath) {
  assert(Array.isArray(dataPath), 'dataPath must be an array of path segments')

  return new Promise((resolve, reject) => {
    const read1 = fs.createReadStream(this.fullPath(dataPath, `${this.extension}`))
    read1.once('open', () => resolve(read1))
    read1.once('error', () => {
      const read2 = fs.createReadStream(this.fullPath(dataPath, `${this.extension}.backup`))
      read2.once('open', () => resolve(read2))
      read2.once('error', (err) => reject(err))
    })
  })
}

/** Create or update a raw file, creating a .backup file of the previous version in the process
 * @param {string[]} path - relative path inside data directory the data is located at
 * @param {ReadableStream} stream - binary data to stream to file
 * @async
 */
exports.writeStream = async function (dataPath, stream) {
  assert(Array.isArray(dataPath), 'dataPath must be an array of path segments')

  // little utility to listen to events on stuff with an async await style
  function event (obj, event, errEvent = 'error') {
    return new Promise((resolve, reject) => {
      obj.once(event, (arg) => resolve(arg))
      obj.once(errEvent, (err) => reject(err))
    })
  }

  const path1 = this.fullPath(dataPath, this.extension)
  const path2 = this.fullPath(dataPath, `${this.extension}.backup`)

  // ensure directory exists
  const folderPath = path.dirname(path1)
  await fs.ensureDir(folderPath)

  const rand = `${Math.round(Math.random() * 0xFFFFFF)}-${Math.round(Math.random() * 0xFFFFFF)}`
  const tempPath = path.join(os.tmpdir(), `pigeon-optics-writing-${rand}${this.extension}`)
  await event(stream.pipe(fs.createWriteStream(tempPath)), 'finish')

  // update backup with a copy of what was here previously if something old exists
  if (await fs.pathExists(path1)) {
    await fs.remove(path2)
    await fs.move(path1, path2)
  }

  await fs.move(tempPath, path1)
  await fs.remove(path2) // everything succeeded, we can erase the backup
}

/**
 * Callback required by most find methods.
 * @callback module:models/file/raw.updateBlock
 * @async
 * @param {Buffer} data Current value of the file, or undefined if the file doesn't exist
 * @returns {Buffer} Buffer of data to write to the file, or undefined if no update should be written
 */

/** update a file at a given path, using tiny-function-queue to provide file locking to prevent clobbering
 * if file doesn't exist, data argument to block function will be undefined. You can create the file by returning something!
 * @param {string[]} path - data path
 * @param {module:models/file/raw.updateBlock} block - block(data) is given a Buffer, and if it returns a Buffer, the file is rewritten with the new data
 */
exports.update = async function (dataPath, block) {
  await tq.lockWhile(['file/raw', this.fullPath(dataPath, '')], async () => {
    const data = await this.read(dataPath)
    const update = await block(data)
    if (update !== undefined) {
      if (!Buffer.isBuffer(update)) throw new Error('return value must be undefined or a Buffer')
      await this.write(dataPath, update)
    }
  })
}

/** Remove a raw file or directory
 * @param {string|string[]} [path] - relative path inside data directory the data is located at
 * @async
 */
exports.delete = async function (dataPath = []) {
  await fs.remove(this.fullPath(dataPath, ''))
  await fs.remove(this.fullPath(dataPath, this.extension))
  await fs.remove(this.fullPath(dataPath, `${this.extension}.backup`))
}

/** Checks a given data path for an existing record, and returns true or false async
 * @param {string|string[]} [path] - relative path inside data directory
 * @returns {boolean}
 * @async
 */
exports.exists = async function (dataPath = []) {
  const results = await Promise.all([
    fs.pathExists(this.fullPath(dataPath, '')),
    fs.pathExists(this.fullPath(dataPath, this.extension)),
    fs.pathExists(this.fullPath(dataPath, `${this.extension}.backup`))
  ])

  return results.some(x => x === true)
}

/** List all the records in a data path
 * @param {string[]} [path] - relative path inside data directory to a folder containing multiple records
 * @returns {string[]}
 * @async
 */
exports.iterate = async function * iterate (dataPath = []) {
  try {
    const dir = await fs.opendir(this.fullPath(dataPath))
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
 * @param {string[]} [path] - relative path inside data directory to a folder containing multiple records
 * @returns {string[]}
 * @async
 */
exports.iterateFolders = async function * iterateFolders (dataPath = []) {
  try {
    const dir = await fs.opendir(this.fullPath(dataPath))
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

// create a configured instance of the raw file store
exports.instance = function ({ rootPath = exports.rootPath, extension = exports.extension }) {
  return Object.assign(Object.create(this), {
    rootPath, extension
  })
}
