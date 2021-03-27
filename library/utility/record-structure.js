// utility to discover hash:// uri's inside structured data (records)
// implements https://github.com/hash-uri/hash-uri and optional cid discovery

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

/** transform an object which might contain cid: uri's to use hash:// urls instead
 * @param {*} input - input document, could be any kind of object that is cbor serialisable
 * @param {object} [cidMap] - object with Content-ID keys and hash string maps
 * @returns {*} - input object, deep cloned, with cid: strings swapped for hash:// strings
 */
exports.cidToHash = function cidToHash (input, cidMap = {}) {
  if (typeof input === 'string' && input.match(/^cid:/i)) {
    const contentID = decodeURI(input.slice(4))
    if (cidMap[contentID]) {
      return `${cidMap[contentID]}`
    } else {
      return input
    }
  } else if (input && typeof input === 'object') {
    if (input instanceof Map) {
      return new Map((function * () {
        for (const entry of input.entries()) {
          yield entry.map(x => exports.cidToHash(x, cidMap))
        }
      })())
    } else if (input instanceof Set) {
      return new Set((function * () {
        for (const value of input.values()) yield exports.cidToHash(value, cidMap)
      })())
    } else if (Array.isArray(input)) {
      return input.map(x => exports.cidToHash(x, cidMap))
    } else {
      return Object.fromEntries(Object.entries(input).map(e => e.map(x => exports.cidToHash(x, cidMap))))
    }
  } else {
    return input
  }
}
