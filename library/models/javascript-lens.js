/**
 * This provides storage of javascript lenses, and can execute lenses too
 * Javascript lenses are sandboxed untrusted js code which can generate new views on existing data
 */
const file = require('./cbor-file')
const auth = require('./auth')
const ivm = require('isolated-vm')
const codec = require('./codec')
const fs = require('fs-extra')
const defaults = require('../../package.json').defaults
// Setup a VM for executing javascript lenses
const Isolate = new ivm.Isolate({ memoryLimit: 64 })
// Precompile the codec-lite.ivm init code
const codecIvmCode = fs.readFileSync(require.resolve('./codec-lite.ivm.js')).toString()
const codecScript = Isolate.compileScriptSync(codecIvmCode)

module.exports = {
  /** returns a list of lenses the user has created
   * @param {string} username - username of target user
   * @returns {string[]} - lens names array
   */
  async list (user) {
    return await file.list(`${auth.userFolder(user)}/javascript-lenses`)
  },

  /** writes a lens to the user's data folder
   * @param {string} username - string username
   * @param {string} lens - string name of lens
   * @param {string} mapCode - lens code which returns an array of datasets/views to query
   * @param {string} reduceCode - lens code which returns an array of outputs
   * @async
   */
  async write (user, lens, mapCode, reduceCode) {
    await file.write(`${auth.userFolder(user)}/javascript-lenses/${encodeURIComponent(lens)}/lens`, {
      mapCode,
      reduceCode,
      updated: Date.now()
    })
  },

  /** reads a lens to from user's data folder
   * @param {string} username - string username
   * @param {string} lens - string name of lens
   * @returns {string} - javascript code
   * @async
   */
  async read (user, lens) {
    await file.read(`${auth.userFolder(user)}/javascript-lenses/${encodeURIComponent(lens)}/lens`)
  },

  /** delete a lens to from user's data folder
   * @param {string} username - string username
   * @param {string} lens - string name of lens
   * @async
   */
  async delete (user, lens) {
    await file.delete(`${auth.userFolder(user)}/javascript-lenses/${encodeURIComponent(lens)}`)
  },

  /**
   * async generator function which accepts an async iterable input that emits [recordPath, recordData]
   * and outputs [recordID, recordData, dependencies]. dependencies will be an object with recordPath keys
   * and buffer hash values. This object will always contain the input recordPath, and may contain extra
   * mutable dependancies (/datasets/ and /viewports/ data paths) if the code used lookup() to fetch extra
   * resources. Optional second argument logger can be set to a function which logs text out for debugging
   * if set, logger must be a function which accepts logger('log'|'info'|'error'|'warn', ...args) and is
   * otherwise similar to console.log/warn/error etc
   * @typedef {function} LensMapFunction
   */

  /** load a javascript lens against an input data
   * @param {string} username - user who owns lens
   * @param {string} lens - name of javascript lens
   * @returns {LensMapFunction}
   * @async
   */
  async loadMap (user, lens) {
    return async function * (iterator, logger = null) {
      const config = await this.read(user, lens)
      const mapScript = await Isolate.compileScript(`(function () {\n${config.mapCode}\n})()`, {
        filename: `${defaults.url}/lenses/${user}:${lens}/functions/map.js`,
        lineOffset: -1
      })

      for await (const [recordPath, recordData] of iterator) {
        const context = await Isolate.createContext()
        const outputs = []

        // load embedded codec library
        await codecScript.run(context)

        // Adjust the jail to have a console.log/warn/error/info api, and to remove some non-deterministic features
        if (!logger) logger = (type, ...args) => console.info(`Lens ${user}:${lens}/map console.${type}:`, ...args)
        const emit = (recordID, recordData) => outputs.push([recordID, codec.cloneable.decode(recordData)])
        await context.evalClosure(`
        Math.random = function () { throw new Error('Math.random is non-deterministic and disallowed') }
        function output(recordID, recordData) {
          if (typeof recordID !== 'string' || recordID === '') throw new Error('recordID must be a non-empty string')
          $1.applyIgnored(undefined, [recordID, codec.cloneable.encode(recordData)])
        }
        const console = Object.freeze({
          log:   (...args) => $0.applyIgnored(undefined, ['log',   ...args], { arguments: { copy: true } }),
          warn:  (...args) => $0.applyIgnored(undefined, ['warn',  ...args], { arguments: { copy: true } }),
          error: (...args) => $0.applyIgnored(undefined, ['error', ...args], { arguments: { copy: true } }),
          info:  (...args) => $0.applyIgnored(undefined, ['info',  ...args], { arguments: { copy: true } })
        });`, [logger, emit], { arguments: { reference: true } })

        // copy data in to context
        await context.evalClosure(
          'const recordPath = $0, recordData = codec.cloneable.decode($1);',
          [recordPath, codec.cloneable.encode(recordData)],
          { arguments: { copy: true } }
        )

        // run user script
        mapScript.run(context, {
          timeout: defaults.lensTimeout,
          arguments: { reference: true }
        })

        // ask v8 to free this context's memory
        context.release()
      }
    }
  },

  /**
   * async function which accepts (recordID, data[]) as input
   * and merges all the outputs of LensMapFunction that output the same recordID string, in to one value
   * for use in a viewport, returns an arbitrary type
   * @typedef {function} LensReduceFunction
   */

  /** load a javascript lens to use to reduce LensMapFunction outputs in to a final dataset
   * @param {*} user - user who owns lens
   * @param {*} lens - name of javascript lens
   * @returns {function} LensReduceFunction
   */
  async loadReduce (user, lens) {
  }
}
