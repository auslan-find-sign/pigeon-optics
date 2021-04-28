/**
 * Codecs library, implements all the different formats Pigeon Optics can work with
 */
exports.cbor = require('./cbor')
exports.json = require('./json')
exports.jsonLines = require('./json-lines')
exports.yaml = require('./yaml')
exports.msgpack = require('./msgpack')
exports.xml = require('./xml')
exports.html = require('pigeonmark-html')

exports.path = require('./path')
exports.objectHash = require('./object-hash')
exports.respond = require('./respond')

// build a mediaTypeHandlers list
exports.mediaTypeHandlers = Object.fromEntries(Object.values(exports).flatMap(value => {
  if (value && typeof value === 'object' && Array.isArray(value.handles)) {
    return value.handles.map(mediaType => [mediaType, value])
  }
  return []
}))

exports.extensionHandlers = Object.fromEntries(Object.values(exports).flatMap(value => {
  if (value && typeof value === 'object' && Array.isArray(value.extensions)) {
    return value.extensions.map(ext => [ext.toLowerCase(), value])
  }
  return []
}))

/**
 * returns codec if a matching media type or file extension is found, otherwise undefined
 * @param {string} query
 * @returns {object|undefined}
 */
exports.for = function (query) {
  if (exports.mediaTypeHandlers[query]) {
    return exports.mediaTypeHandlers[query]
  } else if (query.includes('.')) {
    return Object.entries(exports.extensionHandlers).find(([key, value]) => {
      return `${query}`.endsWith(key)
    })[1]
  }
}

// an array of file extensions the codec can read and write
exports.exts = Object.keys(exports.extensionHandlers)
