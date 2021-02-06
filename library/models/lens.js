/**
 * Lenses are code which runs automatically either via local javascript interpreter or via webhook or remote service
 * Lenses must have deterministic output as pure functions, as their results are cached as long as the inputs haven't changed
 * - local javascript lenses are ideal for reformatting data and creating quick indexes
 * - webhooks are ideal for computationally intensive tasks like machine translation, video content analysis
 * - remote services are ideal for heavy computation tasks that aren't highly available or don't have a public address
 *   or for situations where you want to implement your own throttling instead of responding on demand to the lens controller
 *
 * Lenses always include a 'reduce' function which combines multiple outputs that have the same recordID key, implemented in
 * javascript. The map function maybe a javascript function, a webhook or a remote service.
 */
const fs = require('fs-extra')
const file = require('./cbor-file')
const codec = require('./codec')
const ivm = require('isolated-vm')
const defaults = require('../../package.json').defaults

const readPath = require('./read-path')
const auth = require('./auth')
const dataset = require('./dataset')

// Setup a VM for executing javascript lenses
const Isolate = new ivm.Isolate({ memoryLimit: 64 })
// Precompile the codec-lite.ivm init code
const codecIvmCode = fs.readFileSync(require.resolve('./codec-lite.ivm.js')).toString()
const codecScript = Isolate.compileScriptSync(codecIvmCode)

Object.assign(module.exports, {
  ...dataset, // import dataset functions

  // resolve path inside this - override with viewports path in user folder
  path (user, ...path) {
    return [...auth.userFolder(user), 'lenses', ...path]
  },

  async validateConfig (config) {
    dataset.validateConfig(config)
    console.assert(['webhook', 'javascript', 'remote'].includes(config.mapType), 'map type must be javascript, webhook, or remote')
    console.assert(typeof config.mapCode === 'string', 'map code must be a string')
    console.assert(typeof config.reduceCode === 'string', 'reduce code must be a string')
    console.assert(Array.isArray(config.inputs), 'inputs must be an array')
    console.assert(config.inputs.every(x => typeof x === 'string'), 'inputs entries must be strings')
    for (const input of config.inputs) {
      console.assert(await readPath.exists(input), `${input} doesn’t exist`)
    }
  },

  // (re)build a specified viewport
  async build (user, lens) {
    const config = await this.readConfig(user, lens)
    const resultsMap = {}

    // run the map over the whole dataset, transforming to map output objects on disk
    const mapFn = await this.loadMapFunction(config)

    // wrap it with a caching system so same hashed inputs skip running
    const path = this.path
    const usedInputHashKeys = [] // keep track of which cache entries are still in use in the output
    let mapOutputIndex = {}
    if (await file.exists(path(user, lens, 'map-outputs', 'index'))) {
      mapOutputIndex = await file.read(path(user, lens, 'map-outputs', 'index'))
    }
    async function * cacheMaps (inputs) {
      for await (const entry of inputs) {
        const inputHash = codec.objectHash(entry)
        const inputHashString = inputHash.toString('hex')
        if (mapOutputIndex[inputHashString]) {
          for (const [recordID, recordHash] of mapOutputIndex[inputHashString]) {
            if (!resultsMap[recordID]) resultsMap[recordID] = []
            resultsMap[recordID].push(recordHash)
          }
          usedInputHashKeys.push(inputHashString)
        } else {
          // if cache hit failed, yield the entry to the map function to process
          yield entry
        }
      }
    }

    for await (const { input, outputs } of mapFn(cacheMaps(readPath(config.inputs)))) {
      const inputHash = codec.objectHash(input)
      const inputHashString = inputHash.toString('hex')

      const indexEntry = mapOutputIndex[inputHashString] = []
      for (const [recordID, recordData] of outputs) {
        const recordHash = codec.objectHash(recordData)
        await file.write(this.path(user, lens, 'map-output', recordHash.toString('hex')), recordData)
        indexEntry.push([recordID, recordHash])
        if (!resultsMap[recordID]) resultsMap[recordID] = []
        resultsMap[recordID].push(recordHash)
      }
    }

    // reduce the results using the merge function in to entries in this viewport dataset
    const reduceFn = await this.loadReduceFunction(config)
    async function * entryIter () {
      const read = async (hash) => file.read(module.exports.path(user, lens, 'map-output', hash.toString('hex')))
      for (const [recordID, recordHashList] of Object.entries(resultsMap)) {
        let recordData = await read(recordHashList.shift())
        while (recordHashList.length) {
          recordData = await reduceFn(recordData, await read(recordHashList.shift()))
        }
        yield [recordID, recordData]
      }
    }

    await this.overwrite(user, lens, entryIter())
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
   * @param {object} config - lens config object
   * @returns {LensMapFunction}
   * @async
   */
  async loadMapFunction (config) {
    return async function * (iterator, logger = null) {
      for await (const input of iterator) {
        const [recordPath, recordData] = input
        const context = await Isolate.createContext()
        const outputs = []

        // Adjust the jail to have a console.log/warn/error/info api, and to remove some non-deterministic features
        if (!logger) logger = (type, ...args) => console.info(`Lens ${config.user}:${config.name}/map console.${type}:`, ...args)
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
          filename: `${defaults.url}/lenses/${config.user}:${config.name}/functions/map.js`,
          lineOffset: (-lines.length)
        })

        // ask v8 to free this context's memory
        context.release()

        yield { input, outputs }
      }
    }
  },

  /** load a javascript lens to use to reduce LensMapFunction outputs in to a final dataset
   * @param {*} user - user who owns lens
   * @param {*} lens - name of javascript lens
   * @returns {async function} - function accepts two entries and returns one
   */
  async loadReduceFunction (config) {
    return async function (left, right) {
      const context = await Isolate.createContext()
      // load embedded codec library
      await codecScript.run(context)

      const result = await context.evalClosure(`return codec.cloneable.encode((function (left, right) {
        const $0 = undefined, $1 = undefined;
        ${config.reduceCode}
      })(...codec.cloneable.decode([$0, $1])))`,
      codec.cloneable.encode([left, right]), {
        timeout: defaults.lensTimeout,
        arguments: { copy: true },
        result: { copy: true },
        lineOffset: -2,
        columnOffset: -8,
        filename: `${defaults.url}/lenses/${config.user}:${config.name}/functions/reduce.js`
      })

      // ask v8 to free this context's memory
      context.release()

      return codec.cloneable.decode(result.result)
    }
  }
})
