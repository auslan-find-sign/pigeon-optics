/**
 * Dataset Model - provides access to a dataset stored on the service
 * @module
 * @augments modules:models/base-data-model
 */
const auth = require('./auth')
const assert = require('assert')
const settings = require('./settings')

Object.assign(exports, require('./base-data-model'))

exports.source = 'datasets'

// generates a path to data in dataset
exports.path = function (user, ...path) {
  return [...auth.userFolder(user), 'datasets', ...path]
}

// validate a record is acceptable
exports.validateRecord = function (id, data) {
  assert(typeof id === 'string', 'recordID must be a string')
  assert(id !== '', 'recordID must not be empty')
  assert(id.length <= 10000, 'recordID cannot be longer than 10 thousand characters')
  assert(data !== undefined, 'record data cannot be set to undefined, use delete operation instead')
}

/** validates config object for dataset/lens is valid
 * @returns {boolean}
 */
exports.validateConfig = async function (user, name, config) {
  const badChars = "!*'();:@&=+$,/?%#[]".split('')
  assert(!badChars.some(char => name.includes(char)), `Name must not contain any of ${badChars.join(' ')}`)
  assert(name.length >= 1, 'Name cannot be empty')
  assert(name.length <= 250, 'Name must be less than 60 characters long')
  assert(!settings.forbiddenEntityNames.includes(name), 'Name is not allowed by site settings')

  assert(typeof config.memo === 'string', 'memo must be a string')
  assert(typeof config.version === 'number', 'version must be a number')
}
