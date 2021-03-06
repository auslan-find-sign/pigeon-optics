/**
 * Read data from a dataset or viewport or anything else that can show up in the changelog
 */
const datasets = require('./dataset')
const lenses = require('./lens')
const metaVFS = require('./meta-vfs')
const codec = require('./codec')
const sources = { datasets, lenses, meta: metaVFS }

/** ReadPathOutput is what readPath yields
 * @typedef {Object} ReadPathOutput
 * @property {string} path - data path
 * @property {number} version - version number the record is sourced from
 * @property {Buffer} hash - the record's hash
 * @property {*} data - the record's value
 */

/** reads a data path, which could be one specific record, or a whole dataset/viewport
 * @param {string|Array} path - can be a path, or array of paths to read sequentially
 * @yields {ReadPathOutput}
 */
async function * readPath (path) {
  for await (const output of readPath.meta(path)) {
    output.data = await output.read()
    delete output.read
    yield output
  }
}

/** ReadPathOutput is what readPath yields
 * @typedef {Object} ReadPathMetaOutput
 * @property {string} path - data path
 * @property {number} version - version number the record is sourced from
 * @property {Buffer} hash - the record's hash
 * @property {async function} read - async read and return the value/data of this path
 */

/** reads a data path, which could be one specific record, or a whole dataset/viewport
 * @param {string|Array} path - can be a path, or array of paths to read sequentially
 * @yields {ReadPathMetaOutput}
 */
readPath.meta = async function * readPathMeta (path) {
  if (Array.isArray(path)) {
    for (const entry of path) {
      yield * readPath.meta(entry)
    }
  } else if (typeof path === 'string') {
    const params = codec.path.decode(path)
    const source = sources[params.source]

    if (source !== undefined) {
      if (params.recordID !== undefined) {
        // just yield the specific entry
        const meta = await source.readEntryMeta(params.user, params.name, params.recordID)
        yield {
          path: codec.path.encode(params.source, params.user, params.name, params.recordID),
          read: async function readEntry () { return await source.readEntryByHash(params.user, params.name, meta.hash) },
          ...meta
        }
      } else {
        // do the whole dataset
        for (const [recordID, meta] of Object.entries(await source.listEntryMeta(params.user, params.name))) {
          yield {
            path: codec.path.encode(params.source, params.user, params.name, recordID),
            read: async function readEntry () { return await source.readEntryByHash(params.user, params.name, meta.hash) },
            ...meta
          }
        }
      }
    } else {
      throw new Error(`Unknown dataset type "/${params.source}/"`)
    }
  } else {
    throw new Error('path type must be Array or String')
  }
}

readPath.exists = async function readPathExists (path) {
  const params = codec.path.decode(path)
  if (!params) return false
  const source = sources[params.source]
  if (source.recordID) {
    return await source.exists(params.user, params.name, params.recordID)
  } else {
    return await source.exists(params.user, params.name)
  }
}

module.exports = readPath
