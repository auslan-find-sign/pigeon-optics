/**
 * Read data from a dataset or viewport or anything else that can show up in the changelog
 */
const codec = require('./codec')

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
  if (typeof path === 'string') {
    const sources = {
      datasets: require('./dataset'),
      lenses: require('./lens'),
      meta: require('./meta-vfs')
    }

    const params = codec.path.decode(path)
    const source = sources[params.source]

    if (source !== undefined) {
      if (params.recordID !== undefined) {
        // just yield the specific entry
        if (await source.exists(params.author, params.name, params.recordID)) {
          const meta = await source.readMeta(params.author, params.name)
          yield {
            path: codec.path.encode(params.source, params.author, params.name, params.recordID),
            ...meta.records[params.recordID],
            read: () => source.read(params.author, params.name, params.recordID)
          }
        }
      } else {
        // do the whole dataset
        if (await source.exists(params.author, params.name)) {
          for await (const meta of source.iterate(params.author, params.name)) {
            yield {
              path: codec.path.encode(params.source, params.author, params.name, meta.id),
              ...meta
            }
          }
        }
      }
    } else {
      throw new Error(`Unknown source "/${params.source}/..."`)
    }
  } else if (path && Symbol.iterator in path) {
    for (const entry of path) {
      yield * readPath.meta(entry)
    }
  } else {
    throw new Error('path type must be an iterable list (like an Array) of strings or string')
  }
}

readPath.exists = async function readPathExists (path) {
  const params = codec.path.decode(path)
  if (!params) return false

  const sources = {
    datasets: require('./dataset'),
    lenses: require('./lens'),
    meta: require('./meta-vfs')
  }

  const source = sources[params.source]
  if (source.recordID) {
    return await source.exists(params.author, params.name, params.recordID)
  } else {
    return await source.exists(params.author, params.name)
  }
}

module.exports = readPath
