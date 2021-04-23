const uri = require('encodeuricomponent-tag')
const ptr = require('path-to-regexp')

const datasetPath = '/:source(lenses|datasets|meta)/:user\\::name'
const datasetMatch = ptr.match(datasetPath)
// const datasetCompile = ptr.compile(datasetPath)
const recordPath = `${datasetPath}/records/:recordID`
const recordMatch = ptr.match(recordPath)
// const recordCompile = ptr.compile(recordPath)

Object.assign(exports, {
  decode (string) {
    const out = datasetMatch(string) || recordMatch(string)
    if (out) {
      return Object.fromEntries(Object.entries(out.params).map(([prop, value]) => [prop, decodeURIComponent(value)]))
    } else {
      return out
    }
  },

  encode (source, user, name, recordID = undefined) {
    if (typeof source === 'object') {
      return this.encode(source.source, source.user, source.name, source.recordID)
    }

    if (!['lenses', 'datasets', 'meta'].includes(source)) throw new Error('Unknown source')

    if (typeof recordID === 'string') {
      return uri`/${source}/${user}:${name}/records/${recordID}` // recordCompile({ source, user, name, recordID })
    } else {
      return uri`/${source}/${user}:${name}` // datasetCompile({ source, user, name })
    }
  }
})
