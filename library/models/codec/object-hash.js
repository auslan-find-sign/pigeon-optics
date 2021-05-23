const hash = require('object-hash')

const symUndef = Symbol('undefined proxy')

/**
 * uses object-hash npm package to hash a complex object, like those stored in datasets or viewports
 * @param {any} object - input object to hash, maybe containing attachments
 * @returns {Buffer} - sha256 hash (32 bytes) in a nodejs Buffer
 */
module.exports = function objectHash (object) {
  if (object === undefined) object = symUndef
  return hash(object, { algorithm: 'sha256', encoding: 'buffer' })
}
