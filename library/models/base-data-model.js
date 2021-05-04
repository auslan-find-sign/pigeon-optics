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
const stringNaturalCompare = require('string-natural-compare')
const recordStructure = require('../utility/record-structure')
const createMissingAttachmentsError = require('../utility/missing-attachments-error')
const attachments = require('./attachments')
const createHttpError = require('http-errors')

/* read meta info about dataset */
exports.readMeta = async function (author, name) {
  return await this.getFileStore(author, name).read(['meta'])
}

/* update meta about dataset */
exports.updateMeta = async function (author, name, block) {
  const retainObjectList = []
  let notifyVersion = 0
  await this.getFileStore(author, name).update(['meta'], async (config) => {
    if (!config) throw new Error('Dataset doesn\'t exist')
    config.version += 1
    config.updated = Date.now()
    // collect prev version's objects, just to avoid some minor clobbering
    Object.values(config.records).map(({ hash }) => retainObjectList.push(hash))

    try {
      const result = await block(config)
      assert(result && typeof result === 'object', 'block callback function must return an object')
      assert(result.records && typeof result.records === 'object', 'block callback must contain records object property')
      for (const meta of Object.values(result.records)) {
        assert(meta && typeof meta === 'object', 'records property must have object values')
        if (!('version' in meta)) meta.version = config.version
        assert(typeof meta.version === 'number', 'record object value must have a numeric version number')
        assert(meta.version > 0, 'record object must contain version number above 0')
        assert(Buffer.isBuffer(meta.hash), 'record object\'s hash property must be a Buffer')
        assert.strictEqual(meta.hash.length, 32, 'record object\'s hash property must be 32 bytes long')
        retainObjectList.push(meta.hash)
      }

      // sort records object
      result.records = Object.fromEntries(Object.entries(result.records).sort((a, b) => stringNaturalCompare(a[0], b[0])))

      // validate that updated version is good
      await this.validateConfig(author, name, result)

      // update notifyVersion number so downstream lenses don't process repeatedly
      notifyVersion = result.version

      return result
    } finally {
      // garbage collect objects that aren't used in this or the previous version
      await this.getObjectStore(author, name).retain(retainObjectList)
    }
  })

  // notify downstream lenses of the change
  process.nextTick(() => updateEvents.pathUpdated(codec.path.encode(this.source, author, name), notifyVersion))
}

/* read a record */
exports.read = async function (author, name, recordID) {
  const meta = await this.readMeta(author, name)
  const recordMeta = meta.records[recordID]
  return recordMeta && await this.getObjectStore(author, name).read(recordMeta.hash)
}

// either iterates the datasets under specified author, or the recordIDs under that dataset, depending
// which args are provided
exports.iterate = async function * (author, name = undefined) {
  if (name === undefined) {
    const file = require('./file/cbor')
    const path = this.path(author)
    if (await file.exists(path)) {
      yield * file.iterateFolders(path)
    } else {
      throw createHttpError.NotFound('Author account name doesn\'t exist')
    }
  } else {
    const meta = await this.readMeta(author, name)
    for (const id in meta.records) {
      const record = meta.records[id]
      yield {
        id,
        ...record,
        read: async () => await this.getObjectStore(author, name).read(record.hash)
      }
    }
  }
}

/** returns an array of all datasets owned by an author account, or a list of records inside a dataset if name is specified
 * @param {string} author - author who owns dataset
 * @param {string} [name] - name of dataset
 * @returns {string[]} - dataset names or recordIDs if name is specified
 * @async
 */
exports.list = async function (author, name = undefined) {
  return await itToArray(this.iterate(author, name))
}

/* write a single record */
exports.write = async function (author, name, recordID, data) {
  assert(data !== undefined, 'Records cannot be set to undefined')
  assert(data !== null, 'Records cannot be set to null')

  await this.writeEntries(author, name, [[recordID, data]])
}

/**
 * Writes an entries list like Object.entries() format, to the dataset, in a merge-like fashion.
 * Undefined or null value causes deletions like exports.merge(). If overwrite is true, replaces dataset contents.
 * @param {string} author
 * @param {string} name
 * @param {AsyncIterable|Array} entries - entries list of recordIDs and recordData
 * @param {object} [options]
 * @param {boolean} [options.overwrite] - overwrite? if true, all existing records are removed if they aren't in the entries list
 */
exports.writeEntries = async function (author, name, entries, { overwrite = false } = {}) {
  const objectStore = this.getObjectStore(author, name)
  const includedRecords = new Set()

  await this.updateMeta(author, name, async meta => {
    const prevRecords = new Set(Object.keys(meta.records))

    for await (const [id, data] of entries) {
      if (data !== null && data !== undefined) {
        const links = recordStructure.listHashURLs(data)
        const linkChecks = await Promise.all(links.map(async link => ({ link, present: await attachments.has(link.hash) })))
        const missingLinks = linkChecks.filter(x => !x.present).map(x => x.link.toString())
        if (missingLinks.length > 0) throw createMissingAttachmentsError(missingLinks)

        // apply source specific validation rules
        await this.validateRecord(id, data)

        // note down what records we're updating, to support overwrite: true
        includedRecords.add(id)

        const hash = await objectStore.write(data)

        // record didn't exist, or it's value changed
        if (!meta.records[id] || !meta.records[id].hash.equals(hash)) {
          meta.records[id] = { hash, links: links.map(x => x.toString()) }
        }
      } else {
        delete meta.records[id]
      }
    }

    if (overwrite) {
      for (const id of prevRecords) {
        if (!includedRecords.has(id)) {
          delete meta.records[id]
        }
      }
    }

    return meta
  })
}

/* given an input object, merge it (like Object.assign) on to the dataset, but delete any entries whose value is undefined or null */
exports.merge = async function (author, name, records) {
  return await this.writeEntries(author, name, Object.entries(records), { overwrite: false })
}

/* like merge, but doesn't preserve unmentioned records, the dataset only contains the records provided */
exports.overwrite = async function (author, name, records) {
  await this.writeEntries(author, name, Object.entries(records), { overwrite: true })
}

/** delete an entry from a dataset, or the whole dataset if recordID is undefined
 * @param {string} author - author account name who owns dataset
 * @param {string} name - name of dataset
 * @param {string} [recordID] - the dataset record's name
 * @async
 */
exports.delete = async function (author, name, recordID = undefined) {
  if (typeof recordID === 'string') {
    assert(recordID.length > 0, 'recordID can\'t be an empty string')
    await this.updateMeta(author, name, meta => {
      delete meta.records[recordID]
      return meta
    })
  } else {
    await this.getFileStore(author, name).delete([])
    process.nextTick(() => updateEvents.pathUpdated(codec.path.encode('meta', 'system', 'system', this.source)))
  }
}

/** tests if a dataset or specific record exists
 * @returns {boolean}
 */
exports.exists = async function (author, name, recordID = undefined) {
  if (await this.getFileStore(author, name).exists(['meta'])) {
    if (typeof recordID === 'string') return recordID in (await this.readMeta(author, name)).records
    return true
  }
  return false
}

/** create a dataset with a specific name
 * @param {string} author - string author profile name
 * @param {string} name - string name of dataset
 * @param {object} config - object that conains memo field and stuff like that, dataset settings
 * @async
 */
exports.create = async function (author, name, config = {}) {
  const file = this.getFileStore(author, name)
  config.version = 0
  config.created = config.updated = Date.now()
  config.records = {}

  assert(!(await this.exists(author, name)), 'Name already in use already exists, choose another name')
  await this.validateConfig(author, name, config)
  await file.write(['meta'], config)

  process.nextTick(() => {
    updateEvents.pathUpdated(codec.path.encode('meta', 'system', 'system', this.source))
    updateEvents.pathUpdated(codec.path.encode(this.source, author, name), config.version)
  })
}

/**
 * gets a content hash addressed objects storage interface
 * @param {string} author
 * @param {string} name
 * @returns {module:models/file/blob}
 */
exports.getObjectStore = function (author, name) {
  const blob = require('./file/blob').instance({
    extension: '.cbor',
    codec: codec.cbor,
    rootPath: this.path(author, name, 'objects')
  })
  return blob
}

exports.getFileStore = function (author, name) {
  const file = require('./file/cbor').instance({
    rootPath: this.path(author, name)
  })
  return file
}
