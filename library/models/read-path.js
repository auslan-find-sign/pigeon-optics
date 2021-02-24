/**
 * Read data from a dataset or viewport or anything else that can show up in the changelog
 */
const datasets = require('./dataset')
const lenses = require('./lens')
const codec = require('./codec')
const sources = { datasets, lenses }

/** ReadPathOutput is what readPath yields
 * @typedef {Object} ReadPathOutput
 * @property {string} path - data path
 * @property {*} data - the record's value
 * @property {Buffer[32]} hash - the record's hash
 * @property {number} version - version number the record is sourced from
 */

/** reads a data path, which could be one specific record, or a whole dataset/viewport
 * @param {string|Array} path - can be a path, or array of paths to read sequentially
 * @yields {ReadPathOutput}
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
        const record = await source.readEntryMeta(params.user, params.name, params.recordID)
        yield {
          path: codec.path.encode(params.source, params.user, params.name, params.recordID),
          data: await source.readEntryByHash(params.user, params.name, record.hash),
          ...record
        }
      } else {
        // do the whole dataset
        for await (const { id, meta, data } of source.iterateEntries(params.user, params.name)) {
          yield {
            path: codec.path.encode(params.source, params.user, params.name, id),
            data: data,
            ...meta
          }
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
  return await source.exists(params.user, params.name, params.recordID)
}

module.exports = readPath
