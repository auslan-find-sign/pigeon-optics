/**
 * Read data from a dataset or viewport or anything else that can show up in the changelog
 */
const datasets = require('./dataset')
const viewports = require('./viewport')

const ptr = require('path-to-regexp')
const pathDecode = ptr.match('/:source(viewports|datasets)/:user\\::name/:recordID?')
const sources = { datasets, viewports }

async function * readPath (path) {
  const { params } = pathDecode(path)
  const source = sources[params.source]

  if (source !== undefined) {
    if (params.recordID !== undefined) {
      // just yield the specific entry
      yield [params.recordID, await source.readEntry(params.user, params.name, params.recordID)]
    } else {
      // do the whole dataset
      for (const recordID of await source.listEntries(params.user, params.name)) {
        yield [recordID, await source.readEntry(params.user, params.name, recordID)]
      }
    }
  } else {
    throw new Error('root directory of path is not known to readPath()')
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
