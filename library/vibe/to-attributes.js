const stringHyphenate = require('./hyphenate')
const escapeAttribute = require('./escape-attribute')

/**
 * convert an object of attributes in to a stringified serialized version, starting with a space, for building tags
 * @param {object} attributes - object of attributes, like { id: "foo", class: "whatever" }
 * @param {object} [options] - settings to adjust output format
 * @param {boolean} [options.xml] - if enabled, attributes will be formatted in an XML compatible style, less compact
 * @param {boolean} [options.hyphenate] - if true, will convert attribute names from lowerCamelCase to hyphen-case automatically
 * @returns {string}
 */
module.exports = function toAttributes (attributes, { xml = false, hyphenate = false } = {}) {
  return Object.entries(attributes).map(([key, value]) => {
    if (hyphenate) key = stringHyphenate(`${key}`)
    if (value === false) {
      return ''
    } else if (value === true && xml !== true) {
      return ` ${escapeAttribute(`${key}`)}`
    } else {
      if (typeof value === 'function') value = value()
      if (typeof value !== 'string') value = JSON.stringify(value)
      value = escapeAttribute(`${value}`)
      if (xml === true || !value.match(/^[^ "'`=<>]+$/mg)) value = `"${value}"`
      return ` ${escapeAttribute(`${key}`)}=${value}`
    }
  }).join('')
}
