const buildHTML = require('./build-html')

/**
 * Given a JsonML element, or a string, render it to a HTML string, suitably escaped and structured
 * @param {string|Array} element
 * @returns {string}
 */
module.exports = function encode (element) {
  if (typeof element === 'object' && !Array.isArray(element) && 'JsonML' in element) {
    element = ['#document', element.JsonML]
  }

  return [...buildHTML(element)].join('')
}
