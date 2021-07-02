/**
 * Base Data Model - provides the foundational elements of dataset and lens models
 * @module {object} module:models/base-data-model
 * @interface
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
const { DatasetArchive } = require('dataset-archive/dataset-archive.cjs')
const ScratchPad = require('file-scratch-pad')

/* read meta info about dataset */
exports.readMeta = async function (author, name) {
  return await this.getFileStore(author, name).read(['meta'])
}

/* update meta about dataset */
exports.updateMeta = async function (author, name, block) {
  let notifyVersion = 0
  await this.getFileStore(author, name).update(['meta'], async (config) => {
    if (!config) throw new Error('Dataset doesn\'t exist')
    config.version += 1
    config.updated = Date.now()

    const result = await block(config)
    assert(result && typeof result === 'object', 'block callback function must return an object')
    assert(result.records && typeof result.records === 'object', 'block callback must contain records object property')
    for (const meta of Object.values(result.records)) {
      assert(meta && typeof meta === 'object', 'records property must have object values')
      if (!('version' in meta)) meta.version = config.version
      assert(typeof meta.version === 'number', 'record object value must have a numeric version number')
      assert(meta.version > 0, 'record object must contain version number above 0')
      assert(typeof meta.hash === 'string', 'record object\'s hash property must be a hex string')
      assert.strictEqual(meta.hash.length, 64, 'record object\'s hash property must be 64 characters long')
    }

    // sort records object
    result.records = Object.fromEntries(Object.entries(result.records).sort((a, b) => stringNaturalCompare(a[0], b[0])))

    // validate that updated version is good
    await this.validateConfig(author, name, result)

    // update notifyVersion number so downstream lenses don't process repeatedly
    notifyVersion = result.version

    return result
  })

  // notify downstream lenses of the change
  process.nextTick(() => updateEvents.pathUpdated(codec.path.encode(this.source, author, name), notifyVersion))
}

/**
 * @callback DataModelIterateEntryRead
 * @returns {any} value of the dataset entry
 * @async
 */

/**
 * @typedef {object} DataModelIterateEntry
 * @property {string} id - record id
 * @property {Buffer} hash - hash of entry's data
 * @property {number} version - version of entry's data
 * @property {string[]} links - links to attachments contained in this document
 * @property {DataModelIterateEntryRead} read - function which reads the contents of this entry
 */

/**
 * If name is provided, iterates through the records of a collection, otherwise, iterates the string names of collections
 * the specified author owns.
 * If fastRead is true, iteration will be a bit slower, but the read function will return very quickly, syncronously.
 * If you plan to read more than one value, it's probably best to turn fastRead on. If you wont read more than one, leave it off.
 * @param {string} author - author/owner name
 * @param {string} [name] - collection name
 * @param {object} [options]
 * @param {boolean} [options.fastRead = false] - optimise for reading values quickly, at the expense of more memory use and slower iteration
 * @yields {DataModelIterateEntry}
 * @generator
 * @async
 */
exports.iterate = async function * (author, name = undefined, { fastRead = false } = {}) {
  if (name === undefined) {
    const file = require('./fs/objects')
    const path = this.path(author)
    try {
      for await (const folder of file.iterateFolders(path)) {
        yield folder
      }
    } catch (err) {
      if (err.code === 'ENOENT') throw createHttpError.NotFound('Author account name doesn\'t exist')
      else throw err
    }
  } else {
    const meta = await this.readMeta(author, name)
    if (fastRead) {
      /** @type {dataArc.DatasetArchive} */
      const archive = this.getDataArchive(author, name)

      for await (const [keyBuffer, valueBuffer] of archive.read({ decode: false })) {
        const id = keyBuffer.toString('utf-8')
        yield { id, ...meta.records[id], read: () => Promise.resolve(archive.valueCodec.decode(valueBuffer)) }
      }
    } else {
      for (const id in meta.records) {
        yield { id, ...meta.records[id], read: () => this.read(author, name, id) }
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

/**
 * read a record by it's recordID
 * @param {string} author
 * @param {string} name
 * @param {string} recordID
 * @returns {any} record value
 * @async
 */
exports.read = async function (author, name, recordID) {
  const data = this.getDataArchive(author, name)
  return await data.get(recordID)
}

/**
 * Write the value of a single record
 * @param {string} author
 * @param {string} name
 * @param {string} recordID
 * @param {*} data
 * @async
 */
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
 * @param {AsyncIterable|Iterable|Array|object} entries - entries list of recordIDs and recordData, or an object for key/value storage
 * @param {object} [options]
 * @param {boolean} [options.overwrite] - overwrite? if true, all existing records are removed if they aren't in the entries list
 */
exports.writeEntries = async function (author, name, entries, { overwrite = false } = {}) {
  if (entries && typeof entries === 'object' && !entries[Symbol.asyncIterator] && !entries[Symbol.iterator]) {
    entries = Object.entries(entries)
  }

  const scratch = await ScratchPad.create()

  try {
    await this.updateMeta(author, name, async meta => {
      // iterate through entries, validating them and writing out to scratch pad temporarily
      const entryReaders = []
      for await (const entry of entries) {
        if (!Array.isArray(entry)) throw new Error('Entry must be an Array')
        if (entry.length !== 2) throw new Error('Entry must have a length of 2')
        if (typeof entry[0] !== 'string') throw new Error('key must be a string')
        if (entry[0].length < 1) throw new Error('key must not be empty')
        if (overwrite === true && entry[1] === undefined) throw new Error('in overwrite mode, undefined values are unacceptable')
        if (entry[1] !== undefined) {
          // validate record links
          const links = recordStructure.listHashURLs(entry[1])
          const linkChecks = await Promise.all(links.map(async link => ({ link, present: await attachments.has(link.hash) })))
          const missingLinks = linkChecks.filter(x => !x.present).map(x => x.link.toString())
          if (missingLinks.length > 0) throw createMissingAttachmentsError(missingLinks)

          // apply source specific validation rules
          await this.validateRecord(entry[0], entry[1])

          const hash = codec.objectHash(entry[1]).toString('hex')
          // update meta file's records if the value actually changed or is newly created
          if (meta.records[entry[0]] === undefined || hash !== meta.records[entry[0]].hash) {
            meta.records[entry[0]] = { hash, links: links.map(x => x.toString()) }
          }
        }

        entryReaders.push(await scratch.write(entry))
      }

      // if we got this far, the entries are valid, pop open the dataset archive and write the entries in
      /** @type {dataArc.DatasetArchive} */
      const archive = this.getDataArchive(author, name)

      async function * buildIter () {
        for (const entryReader of entryReaders) {
          yield await entryReader()
        }
      }

      const storedKeys = overwrite ? (await archive.write(buildIter())) : (await archive.merge(buildIter()))

      // remove any records from metadata that aren't present in the archive anymore
      for (const key of Object.keys(meta.records)) {
        if (!storedKeys.has(key)) delete meta.records[key]
      }

      return meta
    })
  } finally {
    scratch.close()
  }
}

/* given an input object, merge it (like Object.assign) on to the dataset, but delete any entries whose value is undefined or null */
exports.merge = async function (author, name, records) {
  return await this.writeEntries(author, name, records, { overwrite: false })
}

/* like merge, but doesn't preserve unmentioned records, the dataset only contains the records provided */
exports.overwrite = async function (author, name, records) {
  return await this.writeEntries(author, name, records, { overwrite: true })
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
    await this.updateMeta(author, name, async meta => {
      const archive = this.getDataArchive(author, name)
      await archive.delete(recordID)

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

  // create data archive
  const data = this.getDataArchive(author, name)
  await data.write([])

  process.nextTick(() => {
    updateEvents.pathUpdated(codec.path.encode('meta', 'system', 'system', this.source))
    updateEvents.pathUpdated(codec.path.encode(this.source, author, name), config.version)
  })
}

/**
 * Get a DatasetArchive instance which can read and manipulate the records collection of this dataset
 * @param {string} author - author/owner name
 * @param {string} name - collection name
 * @returns {DatasetArchive}
 */
exports.getDataArchive = function (author, name, archiveName = 'data') {
  const fileStore = this.getFileStore(author, name)._raw.instance({ extension: '.archive.br' })

  return new DatasetArchive({
    io: {
      async * read () {
        yield * fileStore.readIter([archiveName])
      },
      async write (iterable) {
        await fileStore.writeIter([archiveName], iterable)
      }
    },
    codec: codec.cbor
  })
}

/**
 * Get a cbor encoded file store for storing things like metadata files
 * @param {string} author - author/owner name
 * @param {string} name - collection name
 * @returns {import('./fs/objects').FSObjects}
 */
exports.getFileStore = function (...args) {
  return require('./fs/objects').instance({
    prefix: this.path(...args)
  })
}
