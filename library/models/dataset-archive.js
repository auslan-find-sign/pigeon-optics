/**
 * Dataset Archive format is (possibly?) used to store a dataset in a single flat file on disk
 * It's a simple format, using length-prefixed-stream to chunk keys and values with a specific length
 * The first entry is always a key, which is a raw utf-8 string, the second entry is a JSON value
 * entries after these continue alternating in this zig zag pattern
 */
const { Readable, PassThrough } = require('stream')
const zlib = require('zlib')
// const json = require('./codec/json')
const cbor = require('./codec/cbor')
const lps = require('length-prefixed-stream')

// const valueEncode = any => Buffer.from(json.encode(any), 'utf-8')
// const valueDecode = buffer => json.decode(buffer.toString('utf-8'))
const valueEncode = any => cbor.encode(any)
const valueDecode = buffer => cbor.decode(buffer)

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
        const value = decode ? valueDecode(buffer) : buffer
        yield [key, value]
      }
      index += 1
    }
  }

  /**
   * Given an async iterable, rebuilds the dataset archive with new contents, completely replacing it
   * @param {object} [options]
   * @param {boolean} [options.encode] - should the iterable's stuff be encoded?
   * @param {*} iterable
   */
  async write (iterable, { encode = true } = {}) {
    async function * gen () {
      for await (const object of iterable) {
        if (!Array.isArray(object)) throw new Error('iterator must provide two element arrays')
        if (object.length !== 2) throw new Error('Array must have length of 2')
        if (encode) {
          if (typeof object[0] !== 'string') throw new Error('key must be a string')
          yield Buffer.from(object[0], 'utf-8')
          yield valueEncode(object[1])
        } else {
          if (!Buffer.isBuffer(object[0])) throw new Error('key must be a Buffer')
          if (!Buffer.isBuffer(object[1])) throw new Error('value must be a Buffer')
          yield object[0]
          yield object[1]
        }
      }
    }

    const readStream = Readable.from(gen(), { objectMode: false })
    const chunkPacked = readStream.pipe(lps.encode())
    const compressed = chunkPacked.pipe(zlib.createBrotliCompress(brotliOptions))
    await this.raw.writeStream(this.path, compressed)
  }

  /**
   * filter the contents of the dataset archive using a supplied testing function
   * @param {function (key, value)} filterFunction - function which returns a truthy value or a promise that resolves to one
   * @param {boolean} [includeValue = true] - should value be decoded and provided to filter function?
   */
  async filter (filter, includeValue = true) {
    async function * iter (archive) {
      for await (const [keyBuffer, valueBuffer] of archive.read({ decode: false })) {
        const key = keyBuffer.toString('utf-8')
        if (await (includeValue ? filter(key, valueDecode(valueBuffer)) : filter(key))) {
          yield [keyBuffer, valueBuffer]
        }
      }
    }
    await this.write(iter(this), { encode: false })
  }

  /**
   * rewrite the archive, without specified keys included
   * @param  {...string} keys - list of keys
   */
  async delete (...keys) {
    await this.filter(key => !keys.includes(key), false)
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
   */
  async merge (iter) {
    const set = new Set()
    async function * gen (archive, iter) {
      for await (const [key, value] of iter) {
        if (!set.has(key)) {
          set.add(key)
          if (value !== undefined) yield [Buffer.from(`${key}`, 'utf-8'), valueEncode(value)]
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

    await this.write(gen(this, iter), { encode: false })
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
        result = valueDecode(valueBuffer)
      }
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
