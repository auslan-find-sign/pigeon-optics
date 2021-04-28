const pxml = require('pigeonmark-xml')
const parb = require('pigeonmark-arbitrary')

/**
 * decode a string, if it's arbitrary encoded, do that step too
 * @param {string} string
 * @returns {*}
 */
module.exports = function decode (string) {
  const doc = pxml.decode(`${string}`)
  if (parb.isArbitraryEncoded(doc)) {
    return parb.decode(doc)
  } else {
    return doc
  }
}
