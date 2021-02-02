/**
 * Read data from a dataset or viewport or anything else that can show up in the changelog
 */
const datasets = require('./dataset')
const lenses = require('./lens')
const codec = require('./codec')
const sources = { datasets, lenses }

/** reads a data path, which could be one specific record, or a whole dataset/viewport
 * @param {string|Array} path - can be a path, or array of paths to read sequentially
 */
async function * readPath (path) {
  if (Array.isArray(path)) {
    for (const entry of path) {
      for await (const result of readPath(entry)) {
        yield result
      }
    }
  } else if (typeof path === 'string') {
    const params = codec.path.decode(path)
    /** @type datasets */
    const source = sources[params.source]

    if (source !== undefined) {
      if (params.recordID !== undefined) {
        // just yield the specific entry
        const recordHash = await source.readEntryHash(params.user, params.name, params.recordID)
        yield [
          codec.path.encode(params.source, params.user, params.name, params.recordID),
          await source.readEntryByHash(params.user, params.name, recordHash),
          recordHash
        ]
      } else {
        // do the whole dataset
        for await (const [recordID, recordData, recordHash] of source.iterateEntries(params.user, params.name)) {
          const recordPath = codec.path.encode(params.source, params.user, params.name, recordID)
          yield [recordPath, recordData, recordHash]
        }
      }
    } else {
      throw new Error('root directory of path is not known to readPath()')
    }
  } else {
    throw new Error('path type must be Array or String')
  }
}

readPath.exists = async function (path) {
  const params = codec.path.decode(path)
  if (!params) return false
  const source = sources[params.source]
  return source.exists(params.user, params.name, params.recordID)
}

module.exports = readPath
