/**
 * codec for js output, using javascript-stringify for encoding values to JS code
 * The purpose of this is to make structures more readable. Complex objects like Set and Date can stringify in weird ways
 * with formats like JSON, and aren't all that readable.
 */

const js = require('javascript-stringify')

exports.handles = ['text/javascript', 'application/javascript']
exports.extensions = ['js', 'javascript']

exports.encode = function (value) {
  return js.stringify(value, undefined, 0)
}

exports.print = function (value) {
  return js.stringify(value, undefined, 2)
}
