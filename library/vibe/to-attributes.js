const stringHyphenate = require('./hyphenate')
const assert = require('assert')

const table = {
  '&': '&amp;',
  '"': '&#34;',
  "'": '&#39;',
  '<': '&lt;',
  '>': '&gt;'
}

// returns number of occurances of a search character within string
function countChars (string, char) {
  return Array.prototype.reduce.call(string, (prev, x) => x === char ? prev + 1 : prev, 0)
}

// escape text using a regexp to detect which characters need escaping
function esc (str, regexp) {
  return `${str}`.replace(regexp, char => table[char])
}

const validAttrRegexp = /^[^ "'>/=\0\cA-\cZ\u007F-\u009F]+$/gmi
const validAttrUnquotedRegexp = /^[a-z0-9/?#%&_-]]+$/gmi

/**
 * convert an object of attributes in to a stringified serialized version, starting with a space, for building tags
 * @param {object} attributes - object of attributes, like { id: "foo", class: "whatever" }
 * @param {object} [options] - settings to adjust output format
 * @param {boolean} [options.xml] - if enabled, attributes will be formatted in an XML compatible style, less compact
 * @param {boolean} [options.hyphenate] - if true, will convert attribute names from lowerCamelCase to hyphen-case automatically
 * @returns {string}
 */
module.exports = function toAttributes (attributes, { xml = false, hyphenate = false } = {}) {
  return Object.entries(attributes).map(([name, value]) => {
    if (hyphenate) name = stringHyphenate(`${name}`)
    // other than controls, U+0020 SPACE, U+0022 ("), U+0027 ('), U+003E (>), U+002F (/), U+003D (=), and noncharacters.
    assert(name.match(validAttrRegexp), 'invalid attribute name')

    if (value === false) {
      return ''
    } else if (value === true && !xml) {
      return ` ${name}`
    } else {
      if (typeof value === 'function') value = value()
      if (typeof value !== 'string') value = JSON.stringify(value)

      if (xml || !value.match(validAttrUnquotedRegexp)) {
        if (countChars(value, '"') > countChars(value, "'")) {
          return ` ${name}='${esc(value, /['&>]/g)}'`
        } else {
          return ` ${name}="${esc(value, /["&>]/g)}"`
        }
      } else {
        return ` ${name}=${esc(value, /["'&<>]/g)}`
      }
    }
  }).join('')
}
