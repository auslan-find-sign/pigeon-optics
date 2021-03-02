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
const codec = require('./codec')
const ivm = require('isolated-vm')
const settings = require('./settings')
const queueify = require('../utility/queueify')
const StackTracey = require('stacktracey')

const auth = require('./auth')
const xbytes = require('xbytes')
const parseMs = require('parse-ms')

// Setup a VM for executing javascript lenses
const Isolate = new ivm.Isolate({ memoryLimit: 64 })
// Precompile the codec-lite.ivm init code
const codecIvmCode = fs.readFileSync(require.resolve('./codec-lite.ivm.js')).toString()
const codecScript = Isolate.compileScriptSync(codecIvmCode)

const lens = Object.assign({}, require('./base-data-model'))

lens.source = 'lenses'

// resolve path inside this - override with viewports path in user folder
lens.path = function (user, ...path) {
  return [...auth.userFolder(user), 'lenses', ...path]
}

lens.validateConfig = async function (user, name, config) {
  const badChars = "!*'();:@&=+$,/?%#[]".split('')
  assert(!badChars.some(char => name.includes(char)), `Name must not contain any of ${badChars.join(' ')}`)
  assert(name.length >= 1, 'Name cannot be empty')
  assert(name.length <= 250, 'Name must be less than 60 characters long')
  assert(!settings.forbiddenEntityNames.includes(name), 'Name is not allowed by site settings')

  assert(typeof config.memo === 'string', 'memo must be a string')
  assert(typeof config.version === 'number', 'version must be a number')

  assert(['webhook', 'javascript', 'remote'].includes(config.mapType), 'map type must be javascript, webhook, or remote')
  assert(typeof config.mapCode === 'string', 'map code must be a string')
  assert(typeof config.reduceCode === 'string', 'reduce code must be a string')
  assert(Array.isArray(config.inputs), 'inputs must be an array')
  assert(config.inputs.every(x => typeof x === 'string'), 'inputs entries must be strings')
  assert(config.mapCode.length + config.reduceCode.length < xbytes.parseSize(settings.lensCodeSize), `Lens code must be less than ${settings.lensCodeSize}`)

  const readPath = require('./read-path') // break cyclic dependency
  for (const input of config.inputs) {
    assert(await readPath.exists(input), `${input} doesn’t exist`)
  }
}

// validate a record is acceptable
lens.validateRecord = async function (id, data) {
  assert(typeof id === 'string', 'recordID must be a string')
  assert(id !== '', 'recordID must not be empty')
  assert(id.length <= 10000, 'recordID cannot be longer than 10 thousand characters')
  assert(data !== undefined, 'record data cannot be set to undefined, use delete operation instead')
}

lens.getMapOutputStore = function (user, name) {
  const cborStore = require('./file/cbor').instance({
    rootPath: this.path(user, name, 'map-cache')
  })
  return cborStore
}

/** async iterator outputs an object for each map output, containing it's input
 *  path, error if any, and logs
 * @yields {object}
 */
lens.iterateLogs = async function * (user, name) {
  const mapOutputStore = this.getMapOutputStore(user, name)
  for await (const filename of mapOutputStore.list()) {
    const { input, error, logs } = await mapOutputStore.read([filename])
    yield { input, error, logs }
  }
}

// (re)build map outputs
lens.buildMapOutputs = async function (user, name) {
  const readPath = require('./read-path') // break cyclic dependency
  const mapOutputStore = this.getMapOutputStore(user, name)
  const config = await this.readConfig(user, name)
  const userMapFunc = await this.loadMapFunction(config)
  const outputs = new Set()

  for await (const meta of readPath.meta(config.inputs)) {
    const mixHash = codec.objectHash({ input: meta.hash, code: config.mapCode }).toString('hex')
    outputs.add(mixHash.toString('hex'))
    if (!await mapOutputStore.exists([mixHash])) {
      const input = {
        path: meta.path,
        data: await meta.read()
      }
      const output = await userMapFunc(input)
      await mapOutputStore.write([mixHash], output)
    }
  }

  // garbage collect
  for await (const filename of mapOutputStore.list()) {
    if (!outputs.has(filename)) {
      await mapOutputStore.delete([filename])
    }
  }
}

// async iterator which yields [recordID, recordData] format
lens.reduceMapOutput = async function * (user, name) {
  const mapOutputStore = this.getMapOutputStore(user, name)
  const config = await this.readConfig(user, name)

  // index the map-cache by recordIDs
  const idMap = {}
  for await (const filename of mapOutputStore.list()) {
    const mapResult = await mapOutputStore.read([filename])
    const { outputs, error } = mapResult
    if (!error) {
      outputs.forEach(([recordID], index) => {
        if (!idMap[recordID]) idMap[recordID] = []
        idMap[recordID].push({ filename, index })
      })
    }
  }

  const userReduceFunction = await this.loadReduceFunction(config)

  const NoResult = Symbol('no-result')
  for (const [recordID, locations] of Object.entries(idMap)) {
    let accumulator = NoResult
    for (const { filename, index } of locations) {
      const mapResponse = await mapOutputStore.read([filename])
      const [outputID, outputData] = mapResponse.outputs[index]

      assert(recordID === outputID, 'error reading map outputs, recordIDs aren’t matching')
      if (accumulator === NoResult) {
        accumulator = outputData
      } else {
        accumulator = await userReduceFunction(accumulator, outputData)
      }
    }
    yield [recordID, accumulator]
  }
}

// (re)builds new version of lens dataset output by reducing map output cache
lens.buildReducedVersion = async function (user, name) {
  await this.overwrite(user, name, this.reduceMapOutput(user, name))
}

// (re)build a specified lens
lens.build = async function (user, name) {
  await this.buildMapOutputs(user, name)
  await this.buildReducedVersion(user, name)
}

/**
 * async generator function which accepts an async iterable input that emits [recordPath, recordData]
 * and outputs { outputs, dependencies }. dependencies will be an object with recordPath keys
 * and buffer hash values. This object will always contain the input recordPath, and may contain extra
 * mutable dependencies (/datasets/ and /viewports/ data paths) if the code used lookup() to fetch extra
 * resources. Optional second argument logger can be set to a function which logs text out for debugging
 * if set, logger must be a function which accepts logger('log'|'info'|'error'|'warn', ...args) and is
 * otherwise similar to console.log/warn/error etc
 * @typedef {AsyncFunction} LensMapFunction
 * @param {object} object with path, and data properties
 * @param {null|function} logger - optional logger function accepts same input as console.log but first arg is info|warn|log|error string
 */

/** load a javascript lens against an input data
 * @param {object} config - lens config object
 * @returns {LensMapFunction}
 */
lens.loadMapFunction = function (config) {
  return async function userMapFunction (input, logger = null) {
    const { path, data } = input
    const context = await Isolate.createContext()
    const outputs = []
    const logs = []

    // Adjust the jail to have a console.log/warn/error/info api, and to remove some non-deterministic features
    const log = (type, ...args) => {
      logs.push({ timestamp: Date.now(), type, args })
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

    try {
      await context.evalClosure(lines.join('\n'), [pathInfo, codec.cloneable.encode(data), log, emit], {
        timeout: parseMs(settings.lensTimeout).milliseconds,
        arguments: { reference: true },
        filename: `${settings.url}/lenses/${config.user}:${config.name}/configuration/map.js`,
        lineOffset: (-lines.length) + 2
      })

      // ask v8 to free this context's memory
      context.release()

      return { input: input.path, outputs, logs, error: false }
    } catch (err) {
      // ask v8 to free this context's memory
      context.release()

      // /** @type {string} */
      // const snippedStack = err.stack.split('at (<isolated-vm boundary>)')[0]
      // return { input: input.path, outputs: [], logs, error: snippedStack.trim() }
      const trace = StackTracey(err)
      return { input: input.path, outputs: [], logs, error: trace }
    }
  }
}

/** load a javascript lens to use to reduce LensMapFunction outputs in to a final dataset
 * @param {*} user - user who owns lens
 * @param {*} lens - name of javascript lens
 * @returns {async function} - function accepts two entries and returns one
 */
lens.loadReduceFunction = async function (config) {
  return async function userReduceFunction (left, right) {
    const context = await Isolate.createContext()
    // load embedded codec library
    await codecScript.run(context)

    const result = await context.evalClosure(`return codec.cloneable.encode((function (left, right) {
      const $0 = undefined, $1 = undefined;
      ${config.reduceCode}
    })(...codec.cloneable.decode([$0, $1])))`,
    codec.cloneable.encode([left, right]), {
      timeout: parseMs(settings.lensTimeout).milliseconds,
      arguments: { copy: true },
      result: { copy: true },
      lineOffset: -2,
      columnOffset: -8,
      filename: `${settings.url}/lenses/${config.user}:${config.name}/configuration/reduce.js`
    })

    // ask v8 to free this context's memory
    context.release()

    return codec.cloneable.decode(result.result)
  }
}

Object.assign(exports, queueify.object(lens))
