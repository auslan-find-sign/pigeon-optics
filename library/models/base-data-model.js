/**
 * Base Data Model - provides the foundational elements of dataset and lens models
 * @module {object} module:models/base-data-model
 * @see module:DatasetModel
 * @see module:LensModel
 */
const codec = require('./codec')
const itToArray = require('../utility/async-iterable-to-array')
const assert = require('assert')
const updateEvents = require('../utility/update-events')

/* read meta info about dataset */
exports.readMeta = async function (user, name) {
  return await this.getFileStore(user, name).read(['meta'])
}

/* update meta about dataset */
exports.updateMeta = async function (user, name, block) {
  const retainObjectList = []
  let notifyVersion = 0
  await this.getFileStore(user, name).update(['meta'], async (config) => {
    if (!config) throw new Error('Dataset doesn\'t exist')
    config.version += 1
    config.updated = Date.now()
    // collect prev version's objects, just to avoid some minor clobbering
    Object.values(config.records).map(({ hash }) => retainObjectList.push(hash))

    const result = await block(config)
    assert(result && typeof result === 'object', 'block callback function must return an object')
    assert(result.records && typeof result.records === 'object', 'block callback must contain records object property')
    for (const meta of Object.values(result.records)) {
      assert(meta && typeof meta === 'object', 'records property must have object values')
      if (!('version' in meta)) meta.version = config.version
      assert(typeof meta.version === 'number', 'record object value must have a numeric version number')
      assert(meta.version > 0, 'record object must contain version number above 0')
      retainObjectList.push(meta.hash)
    }

    await this.validateConfig(user, name, result)

    // garbage collect objects that aren't used in this or the previous version
    await this.getObjectStore(user, name).retain(retainObjectList)

    // update notifyVersion number so downstream lenses don't process repeatedly
    notifyVersion = config.version

    return config
  })

  // notify downstream lenses of the change
  process.nextTick(() => updateEvents.pathUpdated(codec.path.encode(this.source, user, name), notifyVersion))
}

/* read a record */
exports.read = async function (user, name, recordID) {
  const meta = await this.readMeta(user, name)
  const recordMeta = meta.records[recordID]
  return recordMeta && await this.getObjectStore(user, name).read(recordMeta.hash)
}

// either iterates the datasets under specified user, or the recordIDs under that dataset, depending
// which args are provided
exports.iterate = async function * (user, name = undefined) {
  if (name === undefined) {
    const file = require('./file/cbor').instance({ rootPath: this.path(user) })
    yield * file.iterateFolders([])
  } else {
    const meta = await this.readMeta(user, name)
    for (const id in meta.records) {
      const record = meta.records[id]
      yield {
        id,
        ...record,
        read: async () => await this.getObjectStore(user, name).read(record.hash)
      }
    }
  }
}

/** returns an array of all datasets owned by a user, or a list of records inside a dataset if name is specified
 * @param {string} user - user who owns dataset
 * @param {string} [name] - user who owns dataset
 * @returns {string[]} - dataset names or recordIDs if name is specified
 * @async
 */
exports.list = async function (user, name = undefined) {
  return await itToArray(this.iterate(user, name))
}

/* write a single record */
exports.write = async function (user, name, recordID, data) {
  assert(data !== undefined, 'Records cannot be set to undefined')
  assert(data !== null, 'Records cannot be set to null')

  await this.validateRecord(recordID, data)
  await this.updateMeta(user, name, async (meta) => {
    const hash = await this.getObjectStore(user, name).write(data)
    if (meta.records[recordID] && meta.records[recordID].hash.equals(hash)) return meta
    meta.records[recordID] = { version: meta.version, hash }
    return meta
  })
}

/* given an input object, merge it (like Object.assign) on to the dataset, but delete any entries whose value is undefined or null */
exports.merge = async function (user, name, records) {
  const deletes = Object.entries(records).filter(([k, v]) => v === undefined || v === null).map(([k, v]) => k)
  const writes = Object.entries(records).filter(([k, v]) => v !== undefined && v !== null)

  await this.updateMeta(user, name, async meta => {
    const objectStore = this.getObjectStore(user, name)
    const writen = Promise.all(writes.map(async ([k, v]) => [k, await objectStore.write(v)]))
    for (const del of deletes) delete meta.records[del]
    for (const [id, hash] of (await writen)) {
      if (!meta.records[id] || !meta.records[id].hash.equals(hash)) {
        meta.records[id] = { hash }
      }
    }
    return meta
  })
}

/* like merge, but doesn't preserve unmentioned records, the dataset only contains the records provided */
exports.overwrite = async function (user, name, records) {
  assert(Object.values(records).every(x => x !== undefined && x !== null), 'Records cannot be set to undefined or null value')

  await this.updateMeta(user, name, async meta => {
    const objectStore = this.getObjectStore(user, name)
    meta.records = Object.fromEntries(await Promise.all(Object.entries(records).map(async ([k, v]) => {
      const hash = await objectStore.write(v)
      if (meta.records[k] && meta.records[k].hash.equals(hash)) return [k, meta.records[k]]
      return [k, { hash }]
    })))
    return meta
  })
}

/** delete an entry from a dataset, or the whole dataset if recordID is undefined
 * @param {string} user - user who owns dataset
 * @param {string} name - name of dataset
 * @param {string} [recordID] - the dataset record's name
 * @async
 */
exports.delete = async function (user, name, recordID = undefined) {
  if (typeof recordID === 'string') {
    assert(recordID.length > 0, 'recordID can\'t be an empty string')
    await this.updateMeta(user, name, meta => {
      delete meta.records[recordID]
      return meta
    })
  } else {
    await this.getFileStore(user, name).delete([])
    process.nextTick(() => updateEvents.pathUpdated(codec.path.encode('meta', 'system', 'system', this.source)))
  }
}

/** tests if a dataset or specific record exists
 * @returns {boolean}
 */
exports.exists = async function (user, name, recordID = undefined) {
  if (await this.getFileStore(user, name).exists(['meta'])) {
    if (typeof recordID === 'string') return recordID in (await this.readMeta(user, name)).records
    return true
  }
  return false
}

/** create a dataset with a specific name
 * @param {string} user - string username
 * @param {string} name - string name of dataset
 * @param {object} config - object that conains memo field and stuff like that, dataset user settings
 * @async
 */
exports.create = async function (user, name, config = {}) {
  const file = this.getFileStore(user, name)
  config.version = 0
  config.created = config.updated = Date.now()
  config.records = {}

  assert(!(await this.exists(user, name)), 'Name already in use already exists, choose another name')
  await this.validateConfig(user, name, config)
  await file.write(['meta'], config)

  process.nextTick(() => {
    updateEvents.pathUpdated(codec.path.encode('meta', 'system', 'system', this.source))
    updateEvents.pathUpdated(codec.path.encode(this.source, user, name), config.version)
  })
}

/** gets a content hash addressed objects storage interface
 *
 * @param {*} user
 * @param {*} name
 * @returns {module:models/file/blob}
 */
exports.getObjectStore = function (user, name) {
  const blob = require('./file/blob').instance({
    extension: '.cbor',
    codec: codec.cbor,
    rootPath: this.path(user, name, 'objects')
  })
  return blob
}

exports.getFileStore = function (user, name) {
  const file = require('./file/cbor').instance({
    rootPath: this.path(user, name)
  })
  return file
}
