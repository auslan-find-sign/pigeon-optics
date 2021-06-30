const fs = require('fs')
const path = require('path')
const settings = require('../settings')
const tq = require('tiny-function-queue')
const restack = require('../../utility/restack')

// encodes a string to be a valid filename but not use meaningful characters like . or /
const encodePathSegment = (string) => encodeURIComponent(string).replace('.', '%2e')
const decodePathSegment = (string) => decodeURIComponent(string)

// singleton file access API, written as a class to make it more easily understood by vscode intellisense
// can be instanced with .instance to create a path sandboxed api or to use a different file extension
class FSRaw {
  constructor (pathPrefix, extension = '.raw') {
    this.pathPrefix = pathPrefix
    this.fileExtension = extension
  }

  /**
   * create an instance, functionally similar to cd, but it jails calls in to the path prefix for security
   * @param {object} options
   * @param {string[]} [prefix] - path segments to bind us in to
   * @param {string} [extension] - override file extension
   * @returns {FSRaw}
   */
  instance ({ prefix, extension }) {
    return new FSRaw([...this.pathPrefix, ...(prefix || [])], extension || this.fileExtension)
  }

  /**
   * returns a string, a real absolute system path to the dataPath specified
   * @param {string[]} dataPath
   * @param {string} suffix - file extension, like '.cbor' for example
   */
  resolveSystemPath (dataPath, suffix = '') {
    const jail = path.resolve(settings.data, ...this.pathPrefix.flat().map(encodePathSegment))
    dataPath = [...this.pathPrefix, dataPath].flat().map(encodePathSegment)
    const segments = [settings.data, ...dataPath]
    const result = `${path.resolve(...segments)}${suffix}`
    if (!result.startsWith(jail)) throw new Error('path would escape data jail somehow, nope!')
    return result
  }

  /**
   * Read an entire file, returning a buffer
   * @param {string[]} path - path segments to file
   * @returns {Buffer}
   */
  async read (path) {
    const chunks = []
    for await (const chunk of this.readIter(path, { chunkSize: 1024 * 1024 })) {
      chunks.push(chunk)
    }
    return Buffer.concat(chunks)
  }

  /**
   * Write a Buffer or string to a file, replacing it's contents
   * @param {string[]} path - path segments to file
   * @param {Buffer|string} data - new contents of file
   */
  async write (path, data) {
    await this.writeIter(path, [data])
  }

  /**
   * Callback required by most find methods.
   * @callback updateBlock
   * @async
   * @param {Buffer} data Current value of the file, or undefined if the file doesn't exist
   * @returns {Buffer|undefined} Buffer of data to write to the file, or undefined if no update should be written
   */

  /** update a file at a given path, using tiny-function-queue to provide file locking to prevent clobbering
   * if file doesn't exist, data argument to block function will be undefined. You can create the file by returning something!
   * @param {string[]} path - data path
   * @param {updateBlock} block - block(data) is given a Buffer, and if it returns a Buffer, the file is rewritten with the new data
   */
  async update (dataPath, block) {
    await tq.lockWhile(['fs/fsraw', ...this.pathPrefix, ...dataPath, this.fileExtension], async () => {
      let data
      try {
        data = await this.read(dataPath)
      } catch (err) {
        // throw errors only if they aren't because file doesn't exist
        if (err.code !== 'ENOENT') throw err
      }
      const update = await block(data)
      if (update !== undefined) {
        if (typeof update !== 'string' && !Buffer.isBuffer(update)) {
          throw new Error('return value must be undefined or a Buffer/string')
        }
        await this.write(dataPath, update)
      }
    })
  }

  /**
   * append some data to an existing file, or create it if it doesn't exist
   * @param {string[]} path
   * @param {string|Buffer} data
   */
  async append (path, data) {
    await this.appendIter(path, [data])
  }

  /**
   * Read a path, optionally with a custom chunk size
   * @param {string[]} path - represented as path segments, auto joined
   * @param {object} [options]
   * @param {number} [options.chunkSize = 65536] - how large should chunks be?
   * @yields {Buffer}
   */
  async * readIter (path, { chunkSize = 64 * 1024 } = {}) {
    let handle
    try {
      try {
        handle = await fs.promises.open(this.resolveSystemPath(path, this.fileExtension), 'r')
      } catch (err) {
        if (err.code === 'ENOENT') {
          handle = await fs.promises.open(this.resolveSystemPath(path, `${this.fileExtension}.backup`), 'r')
        } else {
          throw err
        }
      }

      let position = 0
      while (true) {
        const { buffer, bytesRead } = await handle.read(Buffer.alloc(chunkSize), 0, chunkSize, position)
        position += bytesRead
        if (bytesRead > 0) {
          yield buffer.slice(0, bytesRead)
        }
        // we have reached the end of the file, close and bail
        if (bytesRead < chunkSize) {
          break
        }
      }
    } catch (err) {
      throw restack(err)
    } finally {
      // ensure underlying resources are released
      if (handle) handle.close()
    }
  }

  /**
   * Replace file contents with buffers or strings
   * @param {string[]} path
   * @param {AsyncIterable|Iterable|Array} iterable
   */
  async writeIter (path, iterable) {
    try {
      const tmpPath = this.resolveSystemPath(path, `.temporary-${Date.now().toString(36)}-${Math.round(Math.random() * 0xFFFFFFFF).toString(36)}`)
      const bakPath = this.resolveSystemPath(path, `${this.fileExtension}.backup`)
      const canonicalPath = this.resolveSystemPath(path, this.fileExtension)

      let handle
      try {
        handle = await fs.promises.open(tmpPath, 'wx')
      } catch (err) {
        if (err.code === 'ENOENT') {
          // perhaps the parent directory doesn't exist
          const parentDir = this.resolveSystemPath(path.slice(0, -1), '')
          try {
            await fs.promises.stat(parentDir)
            throw err
          } catch (err) {
            if (err.code === 'ENOENT') {
              await fs.promises.mkdir(parentDir, { recursive: true })
              handle = await fs.promises.open(tmpPath, 'wx')
            }
          }
        } else {
          throw err
        }
      }

      try {
        for await (let chunk of iterable) {
          if (typeof chunk === 'string') chunk = Buffer.from(chunk, 'utf-8')
          else if (!Buffer.isBuffer(chunk)) throw new Error(`Iterable must yield Buffers or Strings, but received ${chunk.constructor}`)
          await handle.write(chunk)
        }
        await handle.close()
        await fs.promises.unlink(bakPath).catch(x => {})
        await fs.promises.rename(canonicalPath, bakPath).catch(x => {})
        await fs.promises.rename(tmpPath, canonicalPath)
        await fs.promises.unlink(bakPath).catch(x => {})
      } catch (err) {
        await fs.promises.unlink(tmpPath).catch(x => {})
        throw err
      }
    } catch (err) {
      throw restack(err)
    }
  }

  /**
   * copy existing file, and then append iterable content in to it, and then swap it in to place
   * @param {string[]} dataPath
   * @param {AsyncIterable|Iterable|Array} iterable
   */
  async appendIter (path, iterable) {
    async function * combine (a, b) {
      try {
        yield * a
      } catch (err) {
        if (err.code !== 'ENOENT') throw err
      }
      yield * b
    }

    await this.writeIter(path, combine(this.readIter(path), iterable))
  }

  /** Remove a raw file or directory
   * @param {string|string[]} [path] - relative path inside data directory the data is located at
   * @async
   */
  async delete (dataPath = []) {
    try {
      const dirPath = this.resolveSystemPath(dataPath, '')
      const mainPath = this.resolveSystemPath(dataPath, `${this.fileExtension}`)
      const backupPath = this.resolveSystemPath(dataPath, `${this.fileExtension}.backup`)

      if (fs.promises.rm) await fs.promises.rm(dirPath, { recursive: true }).catch(_ => {})
      else await fs.promises.rmdir(dirPath, { recursive: true, force: true }).catch(_ => {})

      await fs.promises.unlink(mainPath).catch(_ => {})
      await fs.promises.unlink(backupPath).catch(_ => {})
    } catch (err) {
      throw restack(err)
    }
  }

  /**
   * Rename a piece of data to a new location
   * @param {string[]} from - current dataPath
   * @param {string[]} to - new dataPath
   * @returns {boolean} was it able to rename data?
   */
  async rename (from, to) {
    const results = await Promise.all(['', `${this.fileExtension}`, `${this.fileExtension}.backup`].map(async ext => {
      try {
        await fs.promises.rename(
          this.resolveSystemPath(from, ext),
          this.resolveSystemPath(to, ext)
        )
        return true
      } catch (err) {
        return false
      }
    }))
    return results.some(x => !!x)
  }

  /** Checks a given data path for an existing record, and returns true or false async
   * @param {string|string[]} [path] - relative path inside data directory
   * @returns {boolean}
   * @async
   */
  async exists (dataPath = []) {
    const tests = [
      this.resolveSystemPath(dataPath, ''),
      this.resolveSystemPath(dataPath, `${this.fileExtension}`),
      this.resolveSystemPath(dataPath, `${this.fileExtension}.backup`)
    ]
    const results = await Promise.all(tests.map(async systemPath => {
      try {
        await fs.promises.stat(systemPath)
        return true
      } catch (err) {
        return false
      }
    }))

    return results.some(x => !!x)
  }

  /** List all the records in a data path
   * @param {string[]} [path] - relative path inside data directory to a folder containing multiple records
   * @yields {string} - name of file
   * @async
   */
  async * iterateFiles (dataPath = []) {
    for await (const { file } of this.iterateFilesAndFolders(dataPath)) {
      if (file !== undefined) yield file
    }
  }

  /** List all the folders in a data path
   * @param {string[]} [path] - relative path inside data directory to a folder containing multiple records
   * @yields {string} - name of folder
   * @async
   */
  async * iterateFolders (dataPath = []) {
    for await (const { folder } of this.iterateFilesAndFolders(dataPath)) {
      if (folder !== undefined) yield folder
    }
  }

  /**
   * iterate asyncronously over all files and folders within this data path
   * @param {string[]} dataPath
   * @yields {{ file: string } | { folder: string }}
   * @async
   */
  async * iterateFilesAndFolders (dataPath = []) {
    try {
      const dir = await fs.promises.opendir(this.resolveSystemPath(dataPath))
      for await (const dirent of dir) {
        if (dirent.isDirectory()) {
          yield { folder: decodePathSegment(dirent.name) }
        } else if (dirent.isFile() && dirent.name.endsWith(this.fileExtension)) {
          yield { file: decodePathSegment(dirent.name.slice(0, -this.fileExtension.length)) }
        }
      }
    } catch (err) {
      if (err.code !== 'ENOENT') { // if the data is just missing, silently ignore it yielding no entries
        throw restack(err)
      }
    }
  }
}

module.exports = new FSRaw([], '.raw')
module.exports.FSRaw = FSRaw
