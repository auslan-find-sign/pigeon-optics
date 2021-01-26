/**
 * Read data from a dataset or viewport or anything else that can show up in the changelog
 */
const datasets = require('./dataset')
const viewports = require('./viewport')

const ptr = require('path-to-regexp')
const pathDecode = ptr.match('/:source/:user\\::name/:entryID?')

async function * readPath (path) {
  const { params } = pathDecode(path)
  const sources = { datasets, viewports }
  const source = sources[params.source]

  if (source !== undefined) {
    if (params.entryID !== undefined) {
      // just yield the specific entry
      yield await source.readEntry(params.user, params.name, params.entryID)
    } else {
      // do the whole dataset
      for (const entryID of await source.listEntries(params.user, params.name)) {
        yield await source.readEntry(params.user, params.name, entryID)
      }
    }
  } else {
    throw new Error('root directory of path is not known to readPath()')
  }
}

module.exports = readPath
