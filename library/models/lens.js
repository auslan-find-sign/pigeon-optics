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
const assert = require('assert')
const fs = require('fs-extra')
const file = require('./cbor-file')
const codec = require('./codec')
const ivm = require('isolated-vm')
const defaults = require('../../package.json').defaults
const queueify = require('../utility/queueify')

const readPath = require('./read-path')
const auth = require('./auth')
const dataset = Object.getPrototypeOf(require('./dataset'))

// Setup a VM for executing javascript lenses
const Isolate = new ivm.Isolate({ memoryLimit: 64 })
// Precompile the codec-lite.ivm init code
const codecIvmCode = fs.readFileSync(require.resolve('./codec-lite.ivm.js')).toString()
const codecScript = Isolate.compileScriptSync(codecIvmCode)

Object.assign(exports, queueify.object({
  ...dataset, // import dataset functions

  // resolve path inside this - override with viewports path in user folder
  path (user, ...path) {
    return [...auth.userFolder(user), 'lenses', ...path]
  },

  async validateConfig (config) {
    await dataset.validateConfig(config)
    assert(['webhook', 'javascript', 'remote'].includes(config.mapType), 'map type must be javascript, webhook, or remote')
    assert(typeof config.mapCode === 'string', 'map code must be a string')
    assert(typeof config.reduceCode === 'string', 'reduce code must be a string')
    assert(Array.isArray(config.inputs), 'inputs must be an array')
    assert(config.inputs.every(x => typeof x === 'string'), 'inputs entries must be strings')
    for (const input of config.inputs) {
      assert(await readPath.exists(input), `${input} doesn’t exist`)
    }
  },

  // iterates through logs and errors in lens's last build
  async * iterateLogs (user, lens) {
    for await (const filename of file.list(this.path(user, lens, 'map-cache'))) {
      const mapResult = await file.read(this.path(user, lens, 'map-cache', filename))
      const { input, error, logs } = mapResult
      yield { input, error, logs }
    }
  },

  // (re)build map outputs
  async buildMapOutputs (user, lens) {
    const config = await this.readConfig(user, lens)
    const userMapFunc = await this.loadMapFunction(config)
    const outputs = new Set()

    for await (const meta of readPath.meta(config.inputs)) {
      const mixHash = codec.objectHash({ input: meta.hash, code: config.mapCode })
      const cachePath = this.path(user, lens, 'map-cache', mixHash.toString('hex').toLowerCase())
      outputs.add(mixHash.toString('hex').toLowerCase())
      if (!await file.exists(cachePath)) {
        const input = {
          path: meta.path,
          data: await meta.read()
        }
        let output
        const logs = []
        const logger = (type, ...args) => logs.push({ timestamp: Date.now(), type, args })
        try {
          output = await userMapFunc(input, logger)
          output.error = false
          output.logs = logs
        } catch (err) {
          output = { input, outputs: [], error: err.stack, logs }
        }
        await file.write(cachePath, output)
      }
    }

    // garbage collect
    for await (const filename of file.list(this.path(user, lens, 'map-cache'))) {
      if (!outputs.has(filename)) {
        file.delete(this.path(user, lens, 'map-cache', filename))
      }
    }
  },

  // (re)builds new version of lens dataset output by reducing map output cache
  async buildReducedVersion (user, lens) {
    const config = await this.readConfig(user, lens)
    // index the map-cache by recordIDs
    const idMap = {}
    const errorMap = {}
    for await (const filename of file.list(this.path(user, lens, 'map-cache'))) {
      const mapResult = await file.read(this.path(user, lens, 'map-cache', filename))
      const { input, outputs, error } = mapResult
      if (!error) {
        outputs.forEach(([recordID, data], index) => {
          if (!idMap[recordID]) idMap[recordID] = []
          idMap[recordID].push({ filename, index })
        })
      } else {
        errorMap[input] = error
      }
    }

    const userReduceFunction = await this.loadReduceFunction(config)

    // build each output
    const snapshot = await this.readVersion(user, lens)
    const records = {}
    let changed = false
    const objectsInUse = new Set()
    for (const [recordID, locations] of Object.entries(idMap)) {
      let output
      for (const { filename, index } of locations) {
        const mapResult = await file.read(this.path(user, lens, 'map-cache', filename))
        const nextOutput = mapResult.outputs[index][1]
        if (output === undefined) output = nextOutput
        else output = await userReduceFunction(output, nextOutput)
      }

      const hash = await this.writeObject(user, lens, output)
      objectsInUse.add(hash.toString('hex').toLowerCase())
      if (!snapshot.records[recordID] || !hash.equals(snapshot.records[recordID].hash)) {
        records[recordID] = { hash }
        changed = true
      } else {
        records[recordID] = snapshot.records[recordID]
      }
    }

    // if something changed, save out a new version
    if (changed) {
      await this.writeVersion(user, lens, {
        ...snapshot,
        records
      })

      if (config.garbageCollect) await this.garbageCollect(user, lens)
    }
  },

  // (re)build a specified lens
  async build (user, lens) {
    await this.buildMapOutputs(user, lens)
    await this.buildReducedVersion(user, lens)
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
   * @param {object} object with path, and data properties
   * @param {null|function} logger - optional logger function accepts same input as console.log but first arg is info|warn|log|error string
   */

  /** load a javascript lens against an input data
   * @param {object} config - lens config object
   * @returns {LensMapFunction}
   * @async
   */
  async loadMapFunction (config) {
    return async function userMapFunction (input, logger = null) {
      const { path, data } = input
      const context = await Isolate.createContext()
      const outputs = []

      // Adjust the jail to have a console.log/warn/error/info api, and to remove some non-deterministic features
      const log = (type, ...args) => {
        console.info(`Lens ${config.user}:${config.name}/map console.${type}:`, ...args)
        if (logger) logger(type, ...args)
      }
      const emit = (key, recordData) => {
        outputs.push([key, codec.cloneable.decode(recordData)])
      }

      // load embedded codec library
      await codecScript.run(context)

      // run user script with data
      const lines = [
        'const path = $0.copySync();',
        'const data = codec.cloneable.decode($1.copySync());',
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
      const pathInfo = {
        string: path,
        ...codec.path.decode(path)
      }
      await context.evalClosure(lines.join('\n'), [pathInfo, codec.cloneable.encode(data), log, emit], {
        timeout: defaults.lensTimeout,
        arguments: { reference: true },
        filename: `${defaults.url}/lenses/${config.user}:${config.name}/functions/map.js`,
        lineOffset: (-lines.length)
      })

      // ask v8 to free this context's memory
      context.release()

      return { input: path, outputs }
    }
  },

  /** load a javascript lens to use to reduce LensMapFunction outputs in to a final dataset
   * @param {*} user - user who owns lens
   * @param {*} lens - name of javascript lens
   * @returns {async function} - function accepts two entries and returns one
   */
  async loadReduceFunction (config) {
    return async function userReduceFunction (left, right) {
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
}))
