/**
 * Dataset Archive format is (possibly?) used to store a dataset in a single flat file on disk
 * It's a simple format, using length-prefixed-stream to chunk keys and values with a specific length
 * The first entry is always a key, which is a raw utf-8 string, the second entry is a JSON value
 * entries after these continue alternating in this zig zag pattern
 */
const { Readable, PassThrough } = require('stream')
const zlib = require('zlib')
const cbor = require('./codec/cbor')
const lps = require('length-prefixed-stream')

exports.valueEncode = any => cbor.encode(any)
exports.valueDecode = buffer => cbor.decode(buffer)

const brotliOptions = {
  chunkSize: 32 * 1024,
  params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 5 }
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
   * @param {object} [options]
   * @param {boolean} [options.decode] - should the value be decoded or left as a buffer with V prefix
   * @yields {[id, data]}
   */
  async * read ({ decode = true } = {}) {
    try {
      const bytes = await this.raw.readStream(this.path)
      const decompressed = bytes.pipe(zlib.createBrotliDecompress(brotliOptions))
      const chunked = decompressed.pipe(lps.decode())
      const output = chunked.pipe(new PassThrough({ objectMode: true }))

      let index = 0
      let key
      for await (const buffer of output) {
        if (index % 2 === 0) {
          // key
          key = decode ? buffer.toString('utf-8') : buffer
        } else {
          const value = decode ? exports.valueDecode(buffer) : buffer
          yield [key, value]
        }
        index += 1
      }
    } catch (err) {
      // don't throw errors for missing files, just treat them as empty
      if (err.code !== 'ENOENT') throw err
    }
  }

  /**
   * Given an async iterable, rebuilds the dataset archive with new contents, completely replacing it
   * @param {object} [options]
   * @param {boolean} [options.encode] - should the iterable's stuff be encoded?
   * @param {AsyncIterable|Iterable} iterable
   * @returns {Set.<string>} keys in archive
   * @async
   */
  async write (iterable, { encode = true } = {}) {
    const storedKeys = new Set()
    async function * gen () {
      for await (const object of iterable) {
        if (!Array.isArray(object)) throw new Error('iterator must provide two element arrays')
        if (object.length !== 2) throw new Error('Array must have length of 2')
        // skip entries which are duplicates
        if (storedKeys.has(encode ? object[0] : object[1].toString('utf-8'))) {
          continue
        }

        if (encode) {
          storedKeys.add(object[0])
          if (typeof object[0] !== 'string') throw new Error('key must be a string')
          yield Buffer.from(object[0], 'utf-8')
          yield exports.valueEncode(object[1])
        } else {
          if (!Buffer.isBuffer(object[0])) throw new Error('key must be a Buffer')
          if (!Buffer.isBuffer(object[1])) throw new Error('value must be a Buffer')
          storedKeys.add(object[0].toString('utf-8'))
          yield object[0]
          yield object[1]
        }
      }
    }

    const readStream = Readable.from(gen(), { objectMode: false })
    const chunkPacked = readStream.pipe(lps.encode())
    const compressed = chunkPacked.pipe(zlib.createBrotliCompress(brotliOptions))
    await this.raw.writeStream(this.path, compressed)

    return storedKeys
  }

  /**
   * filter the contents of the dataset archive using a supplied testing function, rewriting the archive with the new subset retained
   * @param {function (key, value)} filterFunction - function which returns a truthy value or a promise that resolves to one
   * @param {boolean} [includeValue = 'auto'] - should value be decoded and provided to filter function? auto detects based on arguments list in function definition
   */
  async filter (filter, includeValue = 'auto') {
    const includeVal = includeValue === 'auto' ? filter.length === 2 : !!includeValue
    async function * iter (archive) {
      for await (const [keyBuffer, valueBuffer] of archive.read({ decode: false })) {
        const key = keyBuffer.toString('utf-8')
        if (await (includeVal ? filter(key, exports.valueDecode(valueBuffer)) : filter(key))) {
          yield [keyBuffer, valueBuffer]
        }
      }
    }
    await this.write(iter(this), { encode: false })
  }

  /**
   * generator yields key,value tuple arrays for any key,value pair which selectFunction evaluates truthy
   * @param {function (key, value)} selectFunction - function which returns a truthy value or a promise that resolves to one
   * @param {boolean} [includeValue = 'auto'] - should value be decoded and provided to select function? auto detects based on arguments list in function definition
   * @yields {[string, any]} values for which selectFn is truthy
   */
  async * select (selectFn, includeValue = 'auto') {
    const includeVal = includeValue === 'auto' ? selectFn.length === 2 : !!includeValue
    for await (const [keyBuffer, valueBuffer] of this.read({ decode: false })) {
      const key = keyBuffer.toString('utf-8')
      if (includeVal) {
        const value = exports.valueDecode(valueBuffer)
        if (await selectFn(key, value)) yield [key, value]
      } else {
        if (await selectFn(key)) yield [key, exports.valueDecode(valueBuffer)]
      }
    }
  }

  /**
   * rewrite the archive, without specified keys included
   * @param  {...string} keys - list of keys
   */
  async delete (...keys) {
    await this.filter(key => !keys.includes(key), false)
  }

  /**
   * delete the whole archive, effectively making it empty, and removing the underlying file
   */
  async deleteArchive () {
    await this.raw.delete(this.path)
  }

  /**
   * rewrite the archive, only including specified keys
   * @param  {...string} keys - list of keys
   */
  async retain (...keys) {
    await this.filter(key => keys.includes(key), false)
  }

  /**
   * rewrite the archive, adding in any content which iterates with a data value other than undefined
   * and removing any content which is does have an undefined value, as well as removing any duplicates
   * @param {AsyncIterable} iter
   * @returns {Set.<string>} set of retained string keys - every key that is still in the archive
   */
  async merge (iter) {
    const set = new Set()
    async function * gen (archive, iter) {
      for await (const [key, value] of iter) {
        if (!set.has(key)) {
          set.add(key)
          if (value !== undefined) {
            yield [Buffer.from(`${key}`, 'utf-8'), exports.valueEncode(value)]
          }
        }
      }

      for await (const [keyBuffer, valueBuffer] of archive.read({ decode: false })) {
        const key = keyBuffer.toString('utf-8')
        if (!set.has(key)) {
          set.add(key)
          yield [keyBuffer, valueBuffer]
        }
      }
    }

    return await this.write(gen(this, iter), { encode: false })
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
    const searchBuffer = Buffer.from(searchKey, 'utf-8')
    for await (const [keyBuffer, valueBuffer] of this.read({ decode: false })) {
      if (searchBuffer.equals(keyBuffer)) {
        result = exports.valueDecode(valueBuffer)
      }
    }
    return result
  }

  /**
   * allow DatasetArchive instances to be used directly as async iterables, for example in for await loops
   * or the Readable.from constructor
   */
  async * [Symbol.asyncIterator] () {
    yield * this.read({ decode: true })
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
