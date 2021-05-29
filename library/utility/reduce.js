const typeDetect = require('type-detect')

/**
 * Reduce two or more documents in to each other, returning one merged document
 * Arrays concatinate
 * Objects and Maps merge
 * Numbers and BitInts add
 * Sets union
 * Buffers, Strings Overwrite
 * Dates returns the most futuristic entry
 * @param {Array} documents
 */
function reduce (documents) {
  const types = documents.map(x => typeDetect(x))
  if (!types.every(x => x === types[0])) {
    // if the types don't match, overwrite with the last value
    return documents.slice(-1)[0]
  }

  const type = types[0]
  if (type === 'Set') {
    // union
    return new Set([...documents.flatMap(x => [...x])])
  } else if (type === 'Array') {
    // arrays concatinate
    return documents.flat(1)
  } else if (type === 'number' || type === 'bigint') {
    // numbers add
    return documents.slice(1).reduce((prev, curr) => prev + curr, documents[0])
  } else if (type === 'Map') {
    // maps merge
    const ret = new Map()
    const keys = new Set(documents.flatMap(x => [...x.keys()]))
    for (const key of keys) {
      const val = reduce(documents.filter(x => x.has(key)).map(x => x.get(key)))
      ret.set(key, val)
    }
    return ret
  } else if (type === 'Object') {
    // objects merge
    const ret = {}
    const keys = new Set(documents.flatMap(x => Object.keys(x)))
    for (const key of keys) {
      const val = reduce(documents.filter(x => Object.prototype.hasOwnProperty.call(x, key)).map(x => x[key]))
      ret[key] = val
    }
    return ret
  } else if (type === 'Date') {
    return documents.sort((a, b) => b.valueOf() - a.valueOf())[0]
  } else {
    return documents.slice(-1)[0]
  }
}

module.exports = reduce
