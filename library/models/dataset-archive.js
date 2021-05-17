/**
 * Dataset Archive format is (possibly?) used to store a dataset in a single flat file on disk
 */
const { Readable } = require('stream')
const zlib = require('zlib')
const cbor = require('./codec/cbor')

const BrotliOpts = {
  chunkSize: 32 * 1024,
  params: {
    [zlib.constants.BROTLI_PARAM_QUALITY]: zlib.constants.BROTLI_MIN_QUALITY
  }
}

class DatasetArchive {
  /**
   *
   * @param {import('./file/raw')} raw - raw file io interface
   * @param {string[]} path - path to file
   */
  constructor (raw, path) {
    this.raw = raw
    this.path = path
  }

  /**
   * iterate the contents of the dataset archive, yielding objects with "id" and "data" fields
   * @yields {[id, data]}
   */
  async * read () {
    const bytes = await this.raw.readStream(this.path)
    for await (const tuple of bytes.pipe(zlib.createBrotliDecompress(BrotliOpts)).pipe(cbor.decoder())) {
      yield tuple
    }
  }

  /**
   * Given an async iterable, rebuilds the dataset archive with new contents, completely replacing it
   * @param {*} iterable
   */
  async write (iterable) {
    async function * gen () {
      for await (const object of iterable) {
        if (!Array.isArray(object)) throw new Error('iterator must provide two element arrays')
        if (object.length !== 2) throw new Error('Array must have length of 2')
        yield cbor.encode(object)
      }
    }
    await this.raw.writeStream(this.path, Readable.from(gen()).pipe(zlib.createBrotliCompress(BrotliOpts)))
  }

  /**
   * filter the contents of the dataset archive using a supplied testing function
   * @param {function (key, value)} filterFunction - function which returns a truthy value or a promise that resolves to one
   */
  async filter (filterFunction) {
    async function * iter (archive, filter) {
      for await (const [key, value] of archive.read()) {
        if (await filter(key, value)) {
          yield [key, value]
        }
      }
    }
    await this.write(iter(this, filterFunction))
  }

  /**
   * rewrite the archive, without specified keys included
   * @param  {...string} keys - list of keys
   */
  async delete (...keys) {
    await this.filter(key => !keys.includes(key))
  }

  /**
   * rewrite the archive, only including specified keys
   * @param  {...string} keys - list of keys
   */
  async retain (...keys) {
    await this.filter(key => keys.includes(key))
  }

  /**
   * rewrite the archive, adding in any content which iterates with a data value other than undefined
   * and removing any content which is does have an undefined value, as well as removing any duplicates
   * @param {AsyncIterable} iter
   */
  async merge (iter) {
    const set = new Set()
    async function * gen (archive, iter) {
      for await (const [key, value] of iter) {
        if (!set.has(key)) {
          set.add(key)
          if (value !== undefined) yield [key, value]
        }
      }

      for await (const [key, value] of archive.read()) {
        if (!set.has(key)) {
          set.add(key)
          if (value !== undefined) yield [key, value]
        }
      }
    }

    await this.write(gen(this, iter))
  }

  /**
   * rewrite archive, overwriting specific key with a new value, or removing it if the value is exactly undefined
   * @param {string} key
   * @param {*} value
   */
  async set (key, value) {
    await this.merge([[key, value]])
  }

  /**
   * search for a specific key and return it's value, or undefined if it isn't found
   * @param {string} searchKey
   */
  async get (searchKey) {
    let result
    for await (const [key, value] of this.read()) {
      if (key === searchKey) result = value
    }
    return result
  }
}

/**
 * given an instance of raw file, and a path, opens it as a dataset archive interface
 * @param {import('./file/raw')} raw - raw file io interface
 * @param {string[]} path - path to file
 */
exports.open = function (raw, path) {
  return new DatasetArchive(raw, path)
}

exports.DatasetArchive = DatasetArchive
