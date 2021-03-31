// default methods of a lens worker

// called when the worker boots up to do some jobs on a specific lens
exports.startup = async function (configuration) {
  console.log('no startup code defined')
}

/** Represents a logged value from underlying lens
 * @typedef {object} LensLog
 * @property {('log'|'warn'|'info'|'error')} type - type of log message
 * @property {*[]} args - pieces of logged message, maybe one string, maybe several types, like the arguments to console.log
 * @property {number} [line] - (optional) line number reference which emitted the log message, for lens types that have code with line numbers
 */

/** Represents a thrown Error from an underlying lens's functions
 * @typedef {object} LensError
 * @property {string} type - error type, like 'SyntaxError' for example
 * @property {string} message - error message, whatever message is specified
 * @property {StackEntry[]} [stack] - stacktrace parts
 */

/** Represents a stack trace entry in a thrown error
 * @typedef {object} StackEntry
 * @property {string} code - source code on the line that emitted the error
 * @property {number} line - line number 1 indexed
 * @property {number} column - column number 0 indexed
 * @property {string} filename - path to file that caused the error, maybe a url, local path, just human readable info
 */

/** An output value
 * @typedef {object} LensOutput
 * @property {string} id - recordID of the output
 * @property {*} data - value of the record
 */

/** Return value of map function
 * @typedef {object} MapOutput
 * @property {LensLog[]} logs - all the log outputs of the map function
 * @property {LensError[]} errors - all the thrown errors of the map function
 * @property {LensOutput[]} outputs - all the outputs of the map function
 */

/** given an input object containing
 * @param {object} input
 * @param {string} input.path - data path of the input record
 * @param {*} input.data - object that is the input data to the lens
 * @returns {MapOutput}
 */
exports.map = async function (input) {
  console.log('no map code defined')
  return {
    logs: [],
    errors: [],
    outputs: []
  }
}

/**
 * @typedef {object} ReduceOutput
 * @property {LensLog[]} logs
 * @property {LensError[]} errors
 * @property {*} value
 * @returns
 */

/** For situations where multiple outputs have the same id string, reduce function handles merging
 * @param {LensOutput} left - left operand output of map function
 * @param {LensOutput} right - right operand output of map function
 * @returns {ReduceOutput}
 */
exports.reduce = async function (left, right) {
  console.log('no reduce function defined')
  return {
    logs: [],
    errors: [],
    value: undefined
  }
}

exports.shutdown = async function () {
  console.log('no shutdown function defined')
}
