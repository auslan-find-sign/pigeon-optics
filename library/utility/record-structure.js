// utility to discover hash:// uri's inside structured data (records)
// implements https://github.com/hash-uri/hash-uri and optional cid: discovery
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
      const hash = m[1].toLowerCase()
      const params = new URLSearchParams(m[2])
      yield { algo: 'sha256', hash, params, toString () { return `hash://sha256/${hash}?${params}` } }
    }
  }
}

/** get an array of all the hash url's in the input
 * @param {*} input
 * @returns {object[]} hashes - { algo: 'sha256', hash <string>, params <URLSearchParams>, toString() }
 */
exports.listHashURLs = function listHashURLs (input) {
  return [...this.iterateHashURLs(input)]
}

/** transform an object which might contain cid:content-id-value-or-filename URLs to use hash:// URLs instead
 * @param {*} input - input document, could be any kind of object that is cbor serialisable
 * @param {object} [filesByName] - the req.filesByName property that ./multipart-files makes
 * @returns {*} - input object, deep cloned, with cid: strings swapped for hash:// strings
 */
exports.resolveContentIDs = function resolveContentIDs (input, filesByName = {}) {
  if (typeof input === 'string' && input.match(/^cid:/im)) {
    const contentID = decodeURI(input.slice('cid:'.length))
    const file = filesByName[contentID]
    if (file) {
      return `hash://sha256/${file.hash.toString('hex')}?type=${encodeURIComponent(file.type)}`
    } else {
      throw createHttpError.BadRequest('File URLs reference missing attachments')
    }
  } else if (input && typeof input === 'object') {
    if (input instanceof Map) {
      return new Map((function * () {
        for (const entry of input.entries()) {
          yield entry.map(x => exports.resolveContentIDs(x, filesByName))
        }
      })())
    } else if (input instanceof Set) {
      return new Set((function * () {
        for (const value of input.values()) yield exports.resolveContentIDs(value, filesByName)
      })())
    } else if (Array.isArray(input)) {
      return input.map(x => exports.resolveContentIDs(x, filesByName))
    } else {
      return Object.fromEntries(Object.entries(input).map(e => e.map(x => exports.resolveContentIDs(x, filesByName))))
    }
  } else {
    return input
  }
}
