const raw = require('./raw')
const crypto = require('crypto')

// singleton file access API, written as a class to make it more easily understood by vscode intellisense
// can be instanced with .instance to create a path sandboxed api or to use a different file extension
class FSBlob {
  constructor ({ raw, createHash }) {
    this._raw = raw
    this.createHash = createHash
  }

  /**
   * create an instance, functionally similar to cd, but it jails calls in to the path prefix for security
   * @param {object} options
   * @param {string[]} [prefix] - path segments to bind us in to
   * @param {string} [extension] - override file extension
   * @returns {FSRaw}
   */
  instance ({ prefix = [], extension, createHash } = {}) {
    const raw = this._raw.instance({ prefix, extension })
    return new FSBlob({ raw, createHash: createHash || this.createHash })
  }

  /**
   * returns a string, a real absolute system path to the dataPath specified
   * @param {string[]} dataPath
   * @param {string} suffix - file extension, like '.cbor' for example
   */
  resolveSystemPath (...args) { return this._raw(...args) }

  /**
   * Read an entire file, returning a buffer
   * @param {string} hash - hash of the content to retrieve
   * @returns {Buffer}
   */
  async read (hash) {
    const chunks = []
    for await (const chunk of this.readIter(hash, { chunkSize: 1024 * 1024 })) {
      chunks.push(chunk)
    }
    return Buffer.concat(chunks)
  }

  /**
   * Write a Buffer or string to a blob file
   * @param {Buffer|string} data - new contents of file
   * @returns {string} hash
   */
  async write (data) {
    return await this.writeIter([data])
  }

  /**
   * Read a path, optionally with a custom chunk size
   * @param {string} hash - hash of content to retrieve
   * @yields {Buffer}
   * @async
   */
  async * readIter (hash) {
    yield * this._raw.readIter([hash])
  }

  /**
   * Replace file contents with buffers or strings
   * @param {AsyncIterable|Iterable|Array} iterable
   * @returns {string} hash in string hex format
   */
  async writeIter (iterable) {
    let hash

    async function * hasher (hashObj, iterable) {
      for await (const chunk of iterable) {
        hashObj.update(chunk)
        yield chunk
      }
      hash = hashObj.digest('hex')
    }

    const tempName = `writing-blob-${Date.now().toString(36)}-${Math.round(Math.random() * 0xFFFFFFFF).toString(36)}`
    await this._raw.writeIter([tempName], hasher(this.createHash(), iterable))
    try {
      await this._raw.rename([tempName], [hash])
    } catch (err) {
      if (err.code === 'ENOENT') {
        await this._raw.delete([tempName])
      } else {
        throw err
      }
    }
    return hash
  }

  /** Remove a raw file or directory
   * @param {string} hash - string hash of data to remove
   * @async
   */
  async delete (hash) {
    await this._raw.delete([hash])
  }

  /** Checks a given data path for an existing record, and returns true or false async
   * @param {string} hash hash of content to check for existance of
   * @returns {boolean}
   * @async
   */
  async exists (hash) {
    return await this._raw.exists([hash])
  }

  /** List all the hashes in this folder
   * @yields {string} - hash of file
   * @async
   */
  async * iterate () {
    for await (const file of this._raw.iterateFiles([])) {
      if (typeof file === 'string' && file.match(/^[a-f0-9]+$/i)) {
        yield file
      }
    }
  }

  /** List all the hashes in this folder
   * @yields {string} - hash of file
   * @async
   */
  [Symbol.asyncIterator] () {
    return this.iterate()
  }
}

module.exports = new FSBlob({
  raw: raw.instance({ prefix: [], extension: '.blob' }),
  createHash: () => crypto.createHash('sha256')
})
