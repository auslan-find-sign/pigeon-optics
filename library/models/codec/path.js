const uri = require('encodeuricomponent-tag')
const ptr = require('path-to-regexp')

const datasetPath = '/:source(lenses|datasets|meta)/:author\\::name'
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

  encode (source, author, name, recordID = undefined) {
    if (typeof source === 'object') {
      return this.encode(source.source, source.author, source.name, source.recordID)
    }

    if (!['lenses', 'datasets', 'meta'].includes(source)) throw new Error('Unknown source')

    if (typeof recordID === 'string') {
      return uri`/${source}/${author}:${name}/records/${recordID}` // recordCompile({ source, author, name, recordID })
    } else {
      return uri`/${source}/${author}:${name}` // datasetCompile({ source, author, name })
    }
  }
})
