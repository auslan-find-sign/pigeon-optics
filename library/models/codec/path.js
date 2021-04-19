const ptr = require('path-to-regexp')
const datasetPath = '/:source(lenses|datasets|meta)/:user\\::name'
const datasetMatch = ptr.match(datasetPath)
const datasetCompile = ptr.compile(datasetPath)
const recordPath = `${datasetPath}/records/:recordID`
const recordMatch = ptr.match(recordPath)
const recordCompile = ptr.compile(recordPath)

Object.assign(exports, {
  decode (string) {
    const out = datasetMatch(string) || recordMatch(string)
    return out ? { ...out.params } : out
  },

  encode (source, user, name, recordID = undefined) {
    if (typeof source === 'object') {
      return this.encode(source.source, source.user, source.name, source.recordID)
    }

    if (typeof recordID === 'string') {
      return recordCompile({ source, user, name, recordID })
    } else {
      return datasetCompile({ source, user, name })
    }
  }
})
