const compressed = require('./compressed')
const lengthPrefix = require('it-length-prefixed')
const tq = require('tiny-function-queue')
const cborCodec = require('../codec/cbor')

// singleton file access API, written as a class to make it more easily understood by vscode intellisense
// can be instanced with .instance to create a path sandboxed api or to use a different file extension
class FSObjects {
  constructor ({ raw, codec }) {
    this.codec = codec
    this._raw = raw
  }

  /**
   * create an instance, functionally similar to cd, but it jails calls in to the path prefix for security
   * @param {object} options
   * @param {string[]} [prefix] - path segments to bind us in to
   * @param {string} [extension] - override file extension
   * @returns {FSRaw}
   */
  instance ({ prefix, extension, codec }) {
    codec = codec !== undefined ? codec : this.codec
    const raw = this._raw.instance({ prefix, extension: extension || `.${codec.extensions[0]}${this._raw.constructor.extension}` })
    return new FSObjects({ raw, codec })
  }

  /**
   * returns a string, a real absolute system path to the dataPath specified
   * @param {string[]} dataPath
   * @param {string} suffix - file extension, like '.cbor' for example
   */
  resolveSystemPath (...args) {
    return this._raw.resolveSystemPath(...args)
  }

  /**
   * Read object from a file. If there's more than one entry, throws an error. Returns undefined if file doesn't exist
   * @param {string[]} path - path segments to file
   * @returns {*}
   */
  async read (path) {
    const iter = await this.readIter(path)
    try {
      const { value } = await iter.next()
      const output = value
      // validate there aren't extra entries, and return value
      const { done } = await iter.next()
      if (!done) throw new Error('More than one entry in file, must use readIter to read this file')
      else return output
    } finally {
      // close out any underlying resources in the error case
      if (iter.return) iter.return()
    }
  }

  /**
   * Write a Buffer or string to a file, replacing it's contents with one single entry
   * @param {string[]} path - path segments to file
   * @param {Buffer|string} data - new contents of file
   */
  async write (path, data) {
    await this.writeIter(path, [data])
  }

  /**
   * Callback required by most find methods.
   * @callback updateBlock
   * @param {*} data Current value of the file, or undefined if the file doesn't exist
   * @returns {*} if return value isn't undefined, the file is updated with the new content
   * @async
   */

  /** for a dataPath, run a given [async] function, and if it returns something other than undefined,
   * rewrite the file with the new value. This call is queued nicely, so parallel updates to the same
   * file wont clobber each other, they'll happen sequentially.
   * If file doesn't exist, data argument to block function will be undefined, but you can create a
   * file by returning something!
   * @param {string[]} path - path to data that is to be read and maybe rewritten
   * @param {updateBlock} block
   */
  async update (path, block) {
    await this.updateIter(path, async (iter) => {
      const i0 = await iter.next()
      if (!i0.done) {
        // validate there is no more than one entry
        const i1 = await iter.next()
        if (!i1.done) throw new Error('update() cannot be used to update files containing multiple entries, use updateIter instead.')
      }

      const result = await block(i0.done ? undefined : i0.value)

      if (result !== undefined) {
        const queue = [result]
        return {
          next () {
            const done = queue.length === 0
            const value = done ? undefined : queue.shift()
            return Promise.resolve({ value, done })
          },
          [Symbol.asyncIterator] () { return this }
        }
      } else {
        return {
          async next () { return Promise.resolve({ value: undefined, done: true }) },
          [Symbol.asyncIterator] () { return this }
        }
      }
    })
  }

  /**
   * Callback required by most find methods.
   * @callback updateIterBlock
   * @param {AsyncIterableIterator} entries - async iterable iterator, yields each object in the fs objects file
   * @yields {*}
   * @async
   */

  /**
   * Update every entry in a file, block is given an async iter, and should eventually return an async iter of
   * entries to write in to new version of the file.
   * concurrent requests to update the same file will queue and run sequentially, so be careful.
   * @param {string[]} path - data path to file containing one or more entries
   * @param {updateIterBlock} block - optionally async function
   */
  async updateIter (path, block) {
    await tq.lockWhile(['fs/fsobjects', ...this._raw.pathPrefix, ...path, this._raw.fileExtension], async () => {
      async function * silenceMissingFileErrors (input) {
        try {
          for await (const entry of input) {
            yield entry
          }
        } catch (err) {
          if (err.code !== 'ENOENT') throw err
        }
      }
      const update = await block(silenceMissingFileErrors(this.readIter(path)))
      if (update && (update[Symbol.asyncIterator] || update[Symbol.iterator])) {
        await this.writeIter(path, update)
      } else if (update !== undefined) {
        throw new Error('second argument to updateIter must return an [async] iterable, or undefined, to leave the file as-is')
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
   * @async
   */
  async * readIter (path) {
    const input = await this._raw.readIter(path)
    const buffers = lengthPrefix.decode()(input)

    for await (const entry of buffers) {
      yield this.codec.decode(entry.slice())
    }
  }

  /**
   * Replace file contents with buffers or strings
   * @param {string[]} path
   * @param {AsyncIterable|Iterable|Array} iterable
   */
  async writeIter (path, iterable) {
    async function * encoder (self, input) {
      for await (const obj of input) {
        const objEncoded = self.codec.encode(obj)
        const lengthPrefixedBl = lengthPrefix.encode.single(objEncoded)
        yield lengthPrefixedBl.slice() // convert BufferList to Buffer
      }
    }
    const encodedBuffers = encoder(this, iterable)
    await this._raw.writeIter(path, encodedBuffers)
  }

  /**
   * copy existing file, and then append iterable content in to it, and then swap it in to place
   * @param {string[]} dataPath
   * @param {AsyncIterable|Iterable|Array} iterable
   */
  async appendIter (path, iterable) {
    async function * combine (a, b) {
      try {
        for await (const chunk of a) {
          yield chunk
        }
      } catch (err) {
        // don't throw if the error is only because of a missing file
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
    await this._raw.delete(dataPath)
  }

  /**
   * Rename a piece of data to a new location
   * @param {string[]} from - current dataPath
   * @param {string[]} to - new dataPath
   * @returns {boolean} was it able to rename data?
   */
  async rename (from, to) {
    return await this._raw.rename(from, to)
  }

  /** Checks a given data path for an existing record, and returns true or false async
   * @param {string|string[]} [path] - relative path inside data directory
   * @returns {boolean}
   * @async
   */
  async exists (dataPath = []) {
    return await this._raw.exists(dataPath)
  }

  /** List all the records in a data path
   * @param {string[]} [path] - relative path inside data directory to a folder containing multiple records
   * @yields {string} - name of file
   * @async
   */
  async * iterateFiles (dataPath = []) {
    yield * this._raw.iterateFiles(dataPath)
  }

  /** List all the folders in a data path
   * @param {string[]} [path] - relative path inside data directory to a folder containing multiple records
   * @yields {string} - name of folder
   * @async
   */
  async * iterateFolders (dataPath = []) {
    yield * this._raw.iterateFolders(dataPath)
  }

  /**
   * iterate asyncronously over all files and folders within this data path
   * @param {string[]} dataPath
   * @yields {{ file: string } | { folder: string }}
   * @async
   */
  async * iterateFilesAndFolders (dataPath = []) {
    yield * this._raw.iterateFilesAndFolders(dataPath)
  }
}

module.exports = new FSObjects({
  raw: compressed.instance({ prefix: [], extension: '.cbor.br' }),
  codec: cborCodec
})

module.exports.FSObjects = FSObjects
