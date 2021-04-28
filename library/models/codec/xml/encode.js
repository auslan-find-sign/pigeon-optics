const pxml = require('pigeonmark-xml')
const parb = require('pigeonmark-arbitrary')
const putils = require('pigeonmark-utils')

/**
 * Encode an object, will attempt to interpret it as PigeonMark/JsonML, and if that can't work, will use arbitrary encoding
 * @param {putils.PMNode|*} obj - object, either PigeonMark/JsonML structure, or arbitrary data which gets pigeonmark:arbitrary encoded
 * @returns {string}
 */
module.exports = function encode (obj) {
  if (putils.isPigeonMark(obj)) {
    try {
      return pxml.encode(obj)
    } catch (err) {
      try {
        return pxml.encode(parb.encode(obj))
      } catch (err2) {
        throw err
      }
    }
  } else {
    return pxml.encode(parb.encode(obj))
  }
}
