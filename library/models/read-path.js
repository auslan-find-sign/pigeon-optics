/**
 * Read data from a dataset or viewport or anything else that can show up in the changelog
 */
const datasets = require('./dataset')
const viewports = require('./viewport')

const ptr = require('path-to-regexp')
const pathDecode = ptr.match('/:source(viewports|datasets)/:user\\::name/:recordID?')
const sources = { datasets, viewports }

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
    const { params } = pathDecode(path)
    /** @type datasets */
    const source = sources[params.source]

    if (source !== undefined) {
      if (params.recordID !== undefined) {
        // just yield the specific entry
        yield [params.recordID, await source.readEntry(params.user, params.name, params.recordID)]
      } else {
        // do the whole dataset
        for await (const [recordID, recordData] of source.iterateEntries(params.user, params.name)) {
          yield [recordID, recordData]
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
  const decoded = pathDecode(path)
  if (!decoded) return false
  const params = decoded.params
  const source = sources[params.source]
  return source.exists(params.user, params.name, params.recordID)
}

module.exports = readPath
