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
   * @param {string} mergeCode - lens code which given 'left' and 'right' outputs returns the result
   * @async
   */
  async write (user, lens, mapCode, mergeCode) {
    await file.write(`${auth.userFolder(user)}/javascript-lenses/${encodeURIComponent(lens)}/lens`, {
      mapCode,
      mergeCode,
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
    return await file.read(`${auth.userFolder(user)}/javascript-lenses/${encodeURIComponent(lens)}/lens`)
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
   * and outputs { outputs, dependencies }. dependencies will be an object with recordPath keys
   * and buffer hash values. This object will always contain the input recordPath, and may contain extra
   * mutable dependencies (/datasets/ and /viewports/ data paths) if the code used lookup() to fetch extra
   * resources. Optional second argument logger can be set to a function which logs text out for debugging
   * if set, logger must be a function which accepts logger('log'|'info'|'error'|'warn', ...args) and is
   * otherwise similar to console.log/warn/error etc
   * @typedef {function} LensMapFunction
   * @param {async function*} iterator - async iterator that yields [recordPath, recordData] to process
   * @param {null|function} logger - optional logger function accepts same input as console.log but first arg is info|warn|log|error string
   */

  /** load a javascript lens against an input data
   * @param {string} username - user who owns lens
   * @param {string} lens - name of javascript lens
   * @returns {LensMapFunction}
   * @async
   */
  async loadMap (user, lens) {
    const config = await this.read(user, lens)

    return async function * (iterator, logger = null) {
      for await (const [recordPath, recordData] of iterator) {
        const context = await Isolate.createContext()
        const outputs = []

        // Adjust the jail to have a console.log/warn/error/info api, and to remove some non-deterministic features
        if (!logger) logger = (type, ...args) => console.info(`Lens ${user}:${lens}/map console.${type}:`, ...args)
        const emit = (key, recordData) => {
          outputs.push([key, codec.cloneable.decode(recordData)])
        }

        // load embedded codec library
        await codecScript.run(context)

        // run user script with data
        const lines = [
          'const recordPath = $0.copySync();',
          'const recordData = codec.cloneable.decode($1.copySync());',
          'Math.random = function () { throw new Error("Math.random() is non-deterministic and disallowed") };',
          'function output(key, recordData) {',
          '  if (typeof key !== "string") throw new Error("first argument key must be a string");',
          '  if (recordData === null || recordData === undefined) throw new Error("second argument recordData must not be null or undefined");',
          '  $3.applySync(undefined, [key, codec.cloneable.encode(recordData)], { arguments: { copy: true } })',
          '};',
          'const console = Object.freeze(Object.fromEntries(["log", "warn", "error", "info"].map(kind => {',
          '  return [kind, (...args) => $2.applyIgnored(undefined, [kind, ...args], { arguments: { copy: true } })]',
          '})));',
          '{',
          'const $0 = undefined, $1 = undefined, $2 = undefined, $3 = undefined',
          config.mapCode,
          '}'
        ]
        await context.evalClosure(lines.join('\n'), [recordPath, codec.cloneable.encode(recordData), logger, emit], {
          timeout: defaults.lensTimeout,
          arguments: { reference: true },
          filename: `${defaults.url}/lenses/${user}:${lens}/map.js`,
          lineOffset: (-lines.length)
        })

        // ask v8 to free this context's memory
        context.release()

        yield { input: recordPath, outputs }
      }
    }
  },

  /** load a javascript lens to use to reduce LensMapFunction outputs in to a final dataset
   * @param {*} user - user who owns lens
   * @param {*} lens - name of javascript lens
   * @returns {async function} - function accepts two entries and returns one
   */
  async loadMerge (user, lens) {
    const config = await this.read(user, lens)

    return async function (left, right) {
      const context = await Isolate.createContext()
      // load embedded codec library
      await codecScript.run(context)

      const result = await context.evalClosure(`return codec.cloneable.encode((function (left, right) {
        const $0 = undefined, $1 = undefined;
        ${config.mergeCode}
      })(...codec.cloneable.decode([$0, $1])))`,
      codec.cloneable.encode([left, right]), {
        timeout: defaults.lensTimeout,
        arguments: { copy: true },
        result: { copy: true },
        lineOffset: -2,
        columnOffset: -8,
        filename: `${defaults.url}/lenses/${user}:${lens}/functions/merge.js`
      })

      // ask v8 to free this context's memory
      context.release()

      console.log('merge result', result)

      return codec.cloneable.decode(result.result)
    }
  }
}
