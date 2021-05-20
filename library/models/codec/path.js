const uri = require('encodeuricomponent-tag')
const ptr = require('path-to-regexp')

const datasetPath = '/:source(lenses|datasets|meta)/:author\\::name'
const datasetMatch = ptr.match(datasetPath)
const recordPath = `${datasetPath}/records/:recordID`
const recordMatch = ptr.match(recordPath)

/**
 * @typedef {object} DecomposedCollectionPath
 * @property {string} source
 * @property {string} author
 * @property {string} name
 */

/**
 * @typedef {object} DecomposedRecordPath
 * @property {string} source
 * @property {string} author
 * @property {string} name
 * @property {string} recordID
 */

/**
 * decode a data path in to it's components
 * @param {string} string
 * @returns {DecomposedCollectionPath|DecomposedRecordPath}
 */
exports.decode = function decode (string) {
  const out = datasetMatch(string) || recordMatch(string)
  if (out) {
    if ('recordID' in out.params) {
      return {
        source: decodeURIComponent(out.params.source),
        author: decodeURIComponent(out.params.author),
        name: decodeURIComponent(out.params.name),
        recordID: decodeURIComponent(out.params.recordID)
      }
    } else {
      return {
        source: decodeURIComponent(out.params.source),
        author: decodeURIComponent(out.params.author),
        name: decodeURIComponent(out.params.name)
      }
    }
  } else {
    return out
  }
}

/**
 * encode a data path's components in to a well formed data path, can also accept an object as first paramater with
 * these property names
 * @param {string|DecomposedCollectionPath|DecomposedRecordPath} source
 * @param {string} [author]
 * @param {string} [name]
 * @param {string} [recordID]
 * @returns {string} /source/author:name or /source/author:name/records/recordID
 */
exports.encode = function encode (source, author, name, recordID = undefined) {
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
