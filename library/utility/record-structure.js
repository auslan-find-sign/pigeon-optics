// utility to discover hash:// uri's inside structured data (records)
// implements https://github.com/hash-uri/hash-uri and optional cid discovery
const createHttpError = require('http-errors')

/** iterates through a complex data structure (like a record value) and yields strings of hash uri's
 * @param {*} input
 * @yields {string} uri
 */
exports.iterateHashURLs = function * iterateHashURLs (input) {
  if (input && typeof input === 'object') {
    if (input[Symbol.iterator] || typeof input.next === 'function') {
      for (const val of input) {
        yield * this.iterateHashURLs(val)
      }
    } else {
      for (const key in input) {
        yield * this.iterateHashURLs(key)
        yield * this.iterateHashURLs(input[key])
      }
    }
  } else if (typeof input === 'string') {
    const m = input.match(/^hash:\/\/sha256\/([a-f0-9]{64})\?([^#?]*)$/im)
    if (m) {
      const hash = Buffer.from(m[1], 'hex')
      const params = new URLSearchParams(m[2])
      yield { algo: 'sha256', hash, params, toString () { return `hash://sha256/${hash.toString('hex')}?${params}` } }
    }
  }
}

/** get an array of all the hash url's in the input
 * @param {*} input
 * @returns {object[]} hashes - { algo: 'sha256', hash <Buffer>, params <URLSearchParams> }
 */
exports.listHashURLs = function listHashURLs (input) {
  return [...this.iterateHashURLs(input)]
}

/** transform an object which might contain file:/// URLs to use hash:// URLs instead
 * @param {*} input - input document, could be any kind of object that is cbor serialisable
 * @param {object} [attachedFilesByName] - the req.attachedFilesByName property that ./multipart-attachments makes
 * @returns {*} - input object, deep cloned, with file:/// strings swapped for hash:// strings
 */
exports.resolveFileURLs = function resolveFileURLs (input, attachedFilesByName = {}) {
  if (typeof input === 'string' && input.match(/^file:\/\/\//im)) {
    const filename = decodeURI(input.slice('file:///'.length))
    const file = attachedFilesByName[filename]
    if (file) {
      return `hash://sha256/${file.hash.toString('hex')}?type=${encodeURIComponent(file.type)}`
    } else {
      throw createHttpError.BadRequest('File URLs reference missing attachments')
    }
  } else if (input && typeof input === 'object') {
    if (input instanceof Map) {
      return new Map((function * () {
        for (const entry of input.entries()) {
          yield entry.map(x => exports.resolveFileURLs(x, attachedFilesByName))
        }
      })())
    } else if (input instanceof Set) {
      return new Set((function * () {
        for (const value of input.values()) yield exports.resolveFileURLs(value, attachedFilesByName)
      })())
    } else if (Array.isArray(input)) {
      return input.map(x => exports.resolveFileURLs(x, attachedFilesByName))
    } else {
      return Object.fromEntries(Object.entries(input).map(e => e.map(x => exports.resolveFileURLs(x, attachedFilesByName))))
    }
  } else {
    return input
  }
}
