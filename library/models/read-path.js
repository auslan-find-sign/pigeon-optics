/**
 * Read data from a dataset or viewport or anything else that can show up in the changelog
 */
const codec = require('./codec')

async function * readPathConfigurable (path, fastRead = false) {
  if (typeof path === 'string') {
    const params = codec.path.decode(path)
    const source = readPath.getSource(params.source)

    if (!source) throw new Error(`Unknown source "/${params.source}/..."`)

    if (await source.exists(params.author, params.name)) {
      const iterator = source.iterate(params.author, params.name, { fastRead })
      for await (const meta of iterator) {
        if (params.recordID === undefined || params.recordID === meta.id) {
          const path = codec.path.encode(params.source, params.author, params.name, meta.id)
          yield { path, ...meta }
        }
      }
    }
  } else if (path && (path[Symbol.iterator] || path[Symbol.asyncIterator])) {
    for await (const entry of path) {
      yield * readPathConfigurable(entry, fastRead)
    }
  } else {
    throw new Error('path type must be an iterable list (like an Array) of strings or string')
  }
}

/** ReadPathOutput is what readPath yields
 * @typedef {Object} ReadPathOutput
 * @property {string} path - data path
 * @property {number} version - version number the record is sourced from
 * @property {string} hash - the record's hash
 * @property {*} data - the record's value
 */

/** reads a data path, which could be one specific record, or a whole dataset/viewport
 * @param {string|Array} path - can be a path, or array of paths to read sequentially
 * @yields {ReadPathOutput}
 */
async function * readPath (path) {
  for await (const entry of readPathConfigurable(path, true)) {
    const data = await entry.read()
    const read = () => Promise.resolve(data)
    yield { ...entry, read, data }
  }
}

/** ReadPathOutput is what readPath yields
 * @typedef {Object} ReadPathMetaOutput
 * @property {string} path - data path
 * @property {number} version - version number the record is sourced from
 * @property {string} hash - the record's hash
 * @property {async function} read - async read and return the value/data of this path
 */

/** reads a data path, which could be one specific record, or a whole dataset/viewport
 * @param {string|Array} path - can be a path, or array of paths to read sequentially
 * @param {object} [options]
 * @param {boolean} [options.fastRead] - set to true to have accelerated reads, if you plan to read a lot of entries
 * @yields {ReadPathMetaOutput}
 */
readPath.meta = async function * readPathMeta (path, { fastRead = false } = {}) {
  yield * readPathConfigurable(path, fastRead)
}

/**
 * test if a dataPath exists.
 * @param {string} dataPath
 * @returns {boolean}
 */
readPath.exists = async function readPathExists (path) {
  const params = codec.path.decode(path)
  if (!params) return false
  const { source, author, name, recordID } = params
  return await readPath.getSource(source).exists(author, name, recordID)
}

/**
 * given a source from a dataPath, returns the data model responsible for serving that data, or undefined
 * @param {string} sourceString - either a source like 'datasets' or a dataPath like '/datasets/author:name/'
 * @returns {import('./base-data-model')}
 */
readPath.getSource = function getSource (sourceString) {
  if (sourceString.startsWith('/')) sourceString = codec.path.decode(sourceString).source
  const sources = { datasets: './dataset', lenses: './lens', meta: './meta-vfs' }
  const sourceProvider = sources[sourceString]
  return sourceProvider ? require(sourceProvider) : undefined
}

module.exports = readPath
