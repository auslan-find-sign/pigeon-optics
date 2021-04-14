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

const auth = require('./auth')
const xbytes = require('xbytes')
const updateEvents = require('../utility/update-events')
const { LensWorker } = require('../workers/interface')
const { PassThrough } = require('stream')

Object.assign(exports, require('./base-data-model'))

exports.source = 'lenses'

// resolve path inside this - override with viewports path in user folder
exports.path = function (user, ...path) {
  return [...auth.userFolder(user), 'lenses', ...path]
}

exports.validateConfig = async function (user, name, config) {
  const badChars = "!*'();:@&=+$,/?%#[]".split('')
  assert(!badChars.some(char => name.includes(char)), `Name must not contain any of ${badChars.join(' ')}`)
  assert(name.length >= 1, 'Name cannot be empty')
  assert(name.length <= 250, 'Name must be less than 60 characters long')
  assert(!settings.forbiddenEntityNames.includes(name), 'Name is not allowed by site settings')

  assert(typeof config.memo === 'string', 'memo must be a string')
  assert(typeof config.version === 'number', 'version must be a number')

  // assert(['webhook', 'javascript', 'remote'].includes(config.mapType), 'map type must be javascript, webhook, or remote')
  assert(config.mapType === 'javascript', 'map type must be "javascript"')
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
exports.validateRecord = async function (id, data) {
  assert(typeof id === 'string', 'recordID must be a string')
  assert(id !== '', 'recordID must not be empty')
  assert(id.length <= 10000, 'recordID cannot be longer than 10 thousand characters')
  assert(data !== undefined, 'record data cannot be set to undefined, use delete operation instead')
}

// returns an object, with dataPath keys, and { user, name } values
exports.getInputs = async function () {
  // TODO: consider optimising/caching this somehow? seems expensive to do frequently
  const inputMap = {}
  for await (const user of auth.iterate()) {
    for await (const name of this.iterate(user)) {
      const lensConfig = await this.readMeta(user, name)
      for (const path of lensConfig.inputs) {
        const normalized = codec.path.encode(codec.path.decode(path))
        if (!Array.isArray(inputMap[normalized])) inputMap[normalized] = []
        inputMap[normalized].push({ user, name })
      }
    }
  }

  return inputMap
}

/** async iterator outputs an object for each map output, containing it's input
 *  path, error if any, and logs
 * @yields {object}
 */
exports.iterateLogs = async function * (user, name) {
  const file = this.getFileStore(user, name)
  yield * await file.readStream(['build-logs'])
}

exports.build = async function (user, name) {
  const readPath = require('./read-path')
  const worker = new LensWorker()
  const objects = this.getObjectStore(user, name)

  await this.updateMeta(user, name, async (meta) => {
    const logStream = new PassThrough({ objectMode: true })
    const logWriter = this.getFileStore(user, name).writeStream(['build-logs'], logStream)
    const prevRecords = meta.records
    meta.records = {} // erase previous records
    await worker.startup(meta)

    for await (const recordMeta of readPath(meta.inputs)) {
      const mapResult = await worker.map(recordMeta)

      const logs = [...mapResult.logs]
      const errors = [...mapResult.errors]

      for (const { id, data } of mapResult.outputs) {
        if (meta.records[id]) {
          const reduceOutput = await worker.reduce(await objects.read(meta.records[id].hash), data)
          if (reduceOutput.errors.length === 0) {
            meta.records[id] = { hash: await objects.write(reduceOutput.value) }
          } else {
            errors.push(...reduceOutput.errors)
          }
          if (reduceOutput.logs.length > 0) logs.push(...reduceOutput.logs)
        } else {
          const hash = await objects.write(data)
          if (prevRecords[id] && prevRecords[id].hash.equals(hash)) {
            meta.records[id] = prevRecords[id]
          } else {
            meta.records[id] = { hash }
          }
        }
      }

      logStream.write({ input: recordMeta.path, logs, errors })
    }

    logStream.end()
    await logWriter

    return meta
  })
}

// setup listening for changes to inputs
updateEvents.events.on('change', async ({ path, source, user, name, recordID }) => {
  const matcher = codec.path.encode({ source, user, name })
  const inputs = await exports.getInputs()
  for (const [path, receivers] of Object.entries(inputs)) {
    if (path === matcher) {
      for (const { user: lensUser, name: lensName } of receivers) {
        await exports.build(lensUser, lensName)
      }
    }
  }
})
