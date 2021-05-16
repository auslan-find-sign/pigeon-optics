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
const codec = require('./codec')
const settings = require('./settings')
const cbor = require('./file/cbor')

const auth = require('./auth')
const xbytes = require('xbytes')
const updateEvents = require('../utility/update-events')
const { LensWorker } = require('../workers/interface')
const reduce = require('../utility/reduce')
const tfq = require('tiny-function-queue')

Object.assign(exports, require('./base-data-model'))

exports.source = 'lenses'

// resolve path inside this - override with viewports path in author account folder
exports.path = function (author, ...path) {
  return [...auth.authorFolder(author), 'lenses', ...path]
}

exports.validateConfig = async function (author, name, config) {
  const badChars = "!*'();:@&=+$,/?%#[]".split('')
  assert(!badChars.some(char => name.includes(char)), `Name must not contain any of ${badChars.join(' ')}`)
  assert(name.length >= 1, 'Name cannot be empty')
  assert(name.length <= 250, 'Name must be less than 60 characters long')
  assert(!settings.forbiddenEntityNames.includes(name), 'Name is not allowed by site settings')

  assert(typeof config.memo === 'string', 'memo must be a string')
  assert(typeof config.version === 'number', 'version must be a number')

  // assert(['webhook', 'javascript', 'remote'].includes(config.mapType), 'map type must be javascript, webhook, or remote')
  assert(config.mapType === 'javascript', 'map type must be "javascript"')
  assert(typeof config.code === 'string', 'map code must be a string')
  assert(Array.isArray(config.inputs), 'inputs must be an array')
  assert(config.inputs.every(x => typeof x === 'string'), 'inputs entries must be strings')
  assert(config.code.length < xbytes.parseSize(settings.lensCodeSize), `Lens code must be less than ${settings.lensCodeSize}`)

  const readPath = require('./read-path') // break cyclic dependency
  for (const input of config.inputs) {
    assert(await readPath.exists(input), `${input} doesn’t exist`)
  }
}

// validate a record is acceptable
exports.validateRecord = async function (id, data) {
  assert(typeof id === 'string', 'recordID must be a string')
  assert(id !== '', 'recordID must not be empty')
  assert(id.length <= 10000, 'recordID cannot be longer than 10 thousand characters')
  assert(data !== undefined, 'record data cannot be set to undefined, use delete operation instead')
}

// returns an object, with dataPath keys, and { author, name } values
exports.getInputs = async function () {
  // TODO: consider optimising/caching this somehow? seems expensive to do frequently
  const inputMap = {}
  for await (const author of auth.iterate()) {
    for await (const name of this.iterate(author)) {
      const lensConfig = await this.readMeta(author, name)
      for (const path of lensConfig.inputs) {
        const normalized = codec.path.encode(codec.path.decode(path))
        if (!Array.isArray(inputMap[normalized])) inputMap[normalized] = []
        inputMap[normalized].push({ author, name })
      }
    }
  }

  return inputMap
}

/** async iterator outputs an object for each map output, containing it's input
 *  path, error if any, and logs
 * @yields {object}
 */
exports.iterateLogs = async function * (author, name) {
  // const file = this.getFileStore(author, name)
  // yield * await file.readStream(['build-logs'])
  const ioCache = this.getIOCache(author, name)
  for await (const ioID of ioCache.iterate([])) {
    const { input, output } = await ioCache.read([ioID])
    yield { input: input.path, errors: output.errors, logs: output.logs }
  }
}

/**
 * get an IO cache filesystem
 * @param {string} author - name of owner authors
 * @param {string} name - lens name
 * @returns {import('./file/cbor')}
 */
exports.getIOCache = function (author, name) {
  return cbor.instance({ rootPath: this.path(author, name, 'cache') })
}

/**
 * rebuild the lens output, refreshing any outputs based on expired cached content
 * @param {string} author - lens owner name
 * @param {string} name - lens name
 */
exports.build = async function (author, name) {
  const readPath = require('./read-path')
  const worker = new LensWorker()
  const objects = this.getObjectStore(author, name)
  const ioCache = this.getIOCache(author, name)
  const usedIO = new Set()
  const dirtyRecords = new Set()
  const recordComposition = new Map()

  await tfq.lockWhile(['lens build', author, name], async () => {
    const meta = await this.readMeta(author, name)

    try {
      // refresh io cache
      for await (const recordMeta of readPath.meta(meta.inputs)) {
        const ioID = `${recordMeta.path}@${codec.objectHash([recordMeta.hash, meta.code]).toString('hex')}`
        usedIO.add(ioID)
        if (!(await ioCache.exists([ioID]))) {
          if (!worker.started) {
            // start up a worker subprocess if we have something needing a fresh map
            const startupResult = await worker.startup(meta)
            if (startupResult.errors.length > 0) {
              throw new exports.LensCodeError(startupResult.errors[0])
            }
          }

          const input = { path: recordMeta.path, version: recordMeta.version, hash: recordMeta.hash }
          const output = await worker.map({ ...input, data: await recordMeta.read() })
          await ioCache.write([ioID], { input, output })
          for (const { id } of output.outputs) {
            dirtyRecords.add(id)
            if (!recordComposition.has(id)) recordComposition.set(id, [])
            recordComposition.get(id).push(ioID)
          }
        } else {
          const { output } = await ioCache.read([ioID])
          for (const { id } of output.outputs) {
            dirtyRecords.add(id)
            if (!recordComposition.has(id)) recordComposition.set(id, [])
            recordComposition.get(id).push(ioID)
          }
        }
      }
    } finally {
      // shut down the worker, if it was started
      if (worker.started) await worker.shutdown()
    }

    // take out the trash in the io cache
    for await (const filename of ioCache.iterate([])) {
      if (!await usedIO.has(filename)) {
        await ioCache.delete([filename])
      }
    }

    // build outputs
    await this.updateMeta(author, name, async (meta) => {
      // remove any records which aren't mentioned by any outputs in the current build
      for (const recordID in meta.records) {
        if (!recordComposition.has(recordID)) delete meta.records[recordID]
      }

      // dirty records are records which have changed in their composition, these need to be reduced and output
      for (const recordID of dirtyRecords) {
        const composition = recordComposition.get(recordID)
        let value
        let first = true
        for (const ioID of composition) {
          const { output } = await ioCache.read([ioID])
          for (const { id, data } of output.outputs) {
            if (id === recordID) {
              if (first) {
                value = data
              } else {
                value = reduce([value, data])
              }
              first = false
            }
          }
        }
        const hash = await objects.write(value)
        meta.records[recordID] = { hash }
      }

      return meta
    })
  })
}

exports.LensCodeError = class LensCodeError extends Error {
  /**
   * LensCodeError represents a bug in user supplied code
   * @param {import('../workers/lens-worker-base').LensError} errorObject
   */
  constructor (errorObject) {
    super(errorObject.message)
    /** @type {string} */
    this.type = errorObject.type
    /** @type {import('../workers/lens-worker-base').StackEntry[]} */
    this.stack = errorObject.stack
    /** @type {import('../workers/lens-worker-base').LensError} */
    this.object = errorObject
  }
}

// setup listening for changes to inputs
updateEvents.events.on('change', async ({ path, source, author, name, recordID }) => {
  const matcher = codec.path.encode({ source, author, name })
  const inputs = await exports.getInputs()
  await tfq.lockWhile('lens background builds', async () => {
    for (const [path, receivers] of Object.entries(inputs)) {
      if (path === matcher) {
        for (const { author: lensAuthor, name: lensName } of receivers) {
          try {
            await exports.build(lensAuthor, lensName)
          } catch (err) {
            console.error('background lens rebuild error', err)
          }
        }
      }
    }
  })
})
