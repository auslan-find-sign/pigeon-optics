/**
 * Base Data Model - provides the foundational elements of dataset and lens models
 */
const codec = require('./codec')
const itToArray = require('../utility/async-iterable-to-array')
const assert = require('assert')
const updateEvents = require('../utility/update-events')

// read a version state info, a frozen representation of everything about the dataset's contents at that moment in time
exports.readVersion = async function (user, name, version = null) {
  const file = this.getFileStore(user, name)
  if (version === null) version = (await this.readConfig(user, name)).version
  if (await file.exists(['versions', `${version}`])) {
    return await file.read(['versions', `${version}`])
  } else {
    return undefined
  }
}

// write a new version of the dataset
exports.writeVersion = async function (user, name, snapshot) {
  const file = this.getFileStore(user, name)
  const config = await this.readConfig(user, name)
  const prevVersion = await this.readVersion(user, name)
  config.version += 1

  snapshot.created = Date.now()
  snapshot.version = config.version
  for (const id in snapshot.records) {
    if (!('version' in snapshot.records[id])) {
      snapshot.records[id].version = snapshot.version
    }
  }

  await file.write(['versions', `${snapshot.version}`], snapshot)
  await this.writeConfig(user, name, config)

  // calculate changes, and ask attachment store to check and prune stuff that changed
  const deletes = Object.keys(prevVersion.records).filter(x => !snapshot.records[x])
  const changes = Object.keys(snapshot.records).filter(x => snapshot.records[x] && (!prevVersion.records[x] || !prevVersion.records[x].hash.equals(snapshot.records[x].hash)))

  const { listReferences } = require('./attachment')
  const attachmentStore = require('./attachment-storage')
  for (const key of [...deletes, ...changes]) {
    const oldEntry = await this.readEntry(user, name, key, prevVersion.version)
    const refs = listReferences(oldEntry)
    for (const attachRef of refs) {
      await attachmentStore.prune(attachRef)
    }
  }

  // garbage collect old objects and versions if enabled
  if (config.garbageCollect === true) {
    await this.garbageCollect(user, name)
  }

  process.nextTick(() => updateEvents.pathUpdated(codec.path.encode(this.source, user, name)))

  return snapshot
}

/** read an entry from a dataset
 * @param {string} user - user who owns dataset
 * @param {string} name - name of dataset
 * @param {string} recordID - the dataset record's name
 * @param {number} [version] - optional version to read from
 * @returns {object} - parsed dataset record data
 * @async
 */
exports.readEntry = async function (user, name, recordID, version = null) {
  const info = await this.readEntryMeta(user, name, recordID, version)
  if (info) {
    return await info.read()
  }
}

/** read an entry's version and hash from this dataset
 * @param {string} user - user who owns dataset
 * @param {string} name - name of dataset
 * @param {string} recordID - the dataset record's name
 * @param {number} [version] - optional version to read from
 * @returns {Object} { version: int, hash: Buffer[32], read: {Async Function} }
 * @async
 */
exports.readEntryMeta = async function (user, name, recordID, version = null) {
  const snapshot = await this.readVersion(user, name, version)
  const record = snapshot.records[recordID]
  if (record) {
    const hash = record.hash
    return {
      ...record,
      read: async () => {
        const objectStore = this.getObjectStore(user, name)
        return await objectStore.read(hash)
      }
    }
  }
}

/** reads each record of this dataset sequentially as an async iterator
 * @param {string} user - user who owns dataset
 * @param {string} name - name of dataset
 * @param {function} filter - optional filter function, gets { id, version, hash } object as arg, boolean return decides if iterator loads and outputs this result
 * @yields {Array} - { id: "recordID", data: {any}, hash: Buffer[32], version: {number} }
 */
exports.iterateEntries = async function * (user, name, filter = null) {
  for await (const meta of this.iterateEntriesMeta(user, name, filter)) {
    const { id, hash, version } = meta
    const data = await meta.read()
    yield { id, hash, version, data }
  }
}

/** reads metadata of each entry in this dataset, with read functions for each entry to get the data
 * @param {string} user - user who owns dataset
 * @param {string} name - name of dataset
 * @param {function} filter - optional filter function, gets { id, version, hash } object as arg, boolean return decides if iterator loads and outputs this result
 * @yields {Array} - { id: "recordID", data: {any}, hash: Buffer[32], version: {number} }
 */
exports.iterateEntriesMeta = async function * (user, name, filter = null) {
  const objectStore = this.getObjectStore(user, name)
  const snapshot = await this.readVersion(user, name)
  for (const [id, { version, hash }] of Object.entries(snapshot.records)) {
    if (!filter || filter({ id, version, hash })) {
      const read = async () => await objectStore.read(hash)
      yield { id, read, hash, version }
    }
  }
}

/** write an entry to a dataset
 * @param {string} username - user who owns dataset
 * @param {string} name - name of dataset
 * @param {string} recordID - the dataset record's name
 * @param {object} data - record data
 * @async
 */
exports.writeEntry = async function (user, name, recordID, data) {
  // require happens in here to break a nasty dependancy cycle
  const attachmentStore = require('./attachment-storage')
  const objectStore = this.getObjectStore(user, name)

  await this.validateRecord(recordID, data)

  const snapshot = await this.readVersion(user, name)
  const dataPath = codec.path.encode(this.source, user, name, recordID)
  const processed = await attachmentStore.storeAttachments(dataPath, data)
  const hash = await objectStore.write(processed)
  snapshot.records[recordID] = { hash, version: snapshot.version + 1, changed: Date.now() }
  await this.writeVersion(user, name, snapshot)
  return snapshot
}

/** delete an entry from a dataset
 * @param {string} user - user who owns dataset
 * @param {string} name - name of dataset
 * @param {string} recordID - the dataset record's name
 * @async
 */
exports.deleteEntry = async function (user, name, recordID) {
  const snapshot = await this.readVersion(user, name)
  if (snapshot.records[recordID]) {
    delete snapshot.records[recordID]
    return await this.writeVersion(user, name, snapshot)
  }
  return snapshot
}

/** list all the recordIDs in a dataset
 * @param {string} user - user who owns dataset
 * @param {string} name - name of dataset
 * @param {number} [version] - dataset version number - defaults to latest
 * @returns {string[]} - dataset entry id's
 * @async
 */
exports.listEntries = async function (user, name, filter = null) {
  return Object.keys(await this.listEntryMeta(user, name, filter))
}

/** plain object mapping recordIDs to object hashes
 * @param {string} user - user who owns dataset
 * @param {string} name - name of dataset or lens
 * @param {number} [version] - dataset version number - defaults to latest
 * @returns {object} - keyed with recordIDs and values are { version: num, hash: Buffer[32], read: {AsyncFunction} }
 * @async
 */
exports.listEntryMeta = async function (user, name, filter = null) {
  return Object.fromEntries((await itToArray(this.iterateEntriesMeta(user, name, filter))).map(x => [x.id, x]))
}

/** get an integer version number for the current version of the dataset
 * every merge increments the number by one
 * @returns {number}
 */
exports.getCurrentVersionNumber = async function (user, name) {
  const config = await this.readConfig(user, name)
  return config.version
}

/** hash the state of the whole dataset quickly
 * @param {string} user - owner of dataset
 * @param {string} name - name of dataset or lens
 */
exports.getCollectionHash = async function (user, name) {
  return codec.objectHash(await this.readVersion(user, name))
}

/** tests if a dataset or specific record exists
 * @returns {boolean}
 */
exports.exists = async function (user, name, recordID = undefined) {
  const file = this.getFileStore(user, name)
  if (!(await file.exists(['config']))) return false
  if (typeof recordID === 'string') {
    return !!(await this.readEntryMeta(user, name, recordID))
  } else {
    return true
  }
}

/** iterates all datasets owned by a user
 * @param {string} username - user who owns dataset
 * @yields {string} dataset name
 * @generator
 * @async
 */
exports.iterate = function (user) {
  const file = require('./file/cbor').instance({ rootPath: this.path(user) })
  return file.listFolders()
}

/** returns an array of all datasets owned by a user
 * @param {string} username - user who owns dataset
 * @returns {string[]} - dataset names
 * @async
 */
exports.list = async function (user) {
  return await itToArray(this.iterate(user))
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
  if (!('garbageCollect' in config)) config.garbageCollect = true
  config.created = Date.now()

  assert(!(await this.exists(user, name)), 'Name already in use already exists, choose another name')
  await this.validateConfig(user, name, config)

  await file.write(['versions', '0'], { version: 0, records: {}, created: Date.now() })
  await this.writeConfig(user, name, config)

  process.nextTick(() => {
    updateEvents.pathUpdated(codec.path.encode('meta', 'system', 'system', this.source))
    updateEvents.pathUpdated(codec.path.encode(this.source, user, name))
  })
}

/** read config of existing dataset
 * @param {string} username - string username
 * @param {string} dataset - string name of dataset
 * @returns {object}
 * @async
 */
exports.readConfig = async function (user, name) {
  const file = this.getFileStore(user, name)
  return {
    ...await file.read(['config']),
    user,
    name
  }
}

/** write config of existing dataset
 * @param {string} user - string username
 * @param {string} name - string name of dataset
 * @param {object} config - object containing config data
 * @returns {object}
 * @async
 */
exports.writeConfig = async function (user, name, config) {
  const file = this.getFileStore(user, name)
  await this.validateConfig(user, name, config)
  await file.write(['config'], config)
}

/** delete a dataset to from user's data folder
 * @param {string} user - string username
 * @param {string} name - string name of dataset
 * @async
 */
exports.delete = async function (user, name) {
  const file = this.getFileStore(user, name)
  await file.delete([])
  process.nextTick(() => updateEvents.pathUpdated(codec.path.encode('meta', 'system', 'system', this.source)))
}

/** overwrite all the entries in a dataset, removing any straglers
 * @param {string} username - user who owns dataset
 * @param {string} name - name of dataset
 * @param {Iterable} entries - (optically async) iterable that outputs an array with two elements, first a string entry name, second an object value
 * @async
 */
exports.overwrite = async function (user, name, entries) {
  // require happens in here to break a nasty dependancy cycle
  const attachmentStore = require('./attachment-storage')
  const objectStore = this.getObjectStore(user, name)

  const config = await this.readConfig(user, name)
  const version = config.version + 1

  const records = {}
  for await (const [id, data] of entries) {
    await this.validateRecord(id, data)

    const dataPath = codec.path.encode(this.source, user, name, id)
    const processed = await attachmentStore.storeAttachments(dataPath, data)
    const hash = await objectStore.write(processed)
    records[id] = { hash, version, changed: Date.now() }
  }

  await this.writeVersion(user, name, { records })

  return records
}

/** overwrite all the listed entries in a dataset, leaving any unmentioned entries in tact
 * @param {string} user - user who owns dataset
 * @param {string} name - name of dataset/lens
 * @param {Iterable} entries - (optically async) iterable that outputs an array with two elements, first a string entry name, second an object value
 * @returns {object} - version records data
 * @async
 */
exports.merge = async function (user, name, entries) {
  // require happens in here to break a nasty dependancy cycle
  const attachmentStore = require('./attachment-storage')
  const objectStore = this.getObjectStore(user, name)

  const config = await this.readConfig(user, name)
  const snapshot = await this.readVersion(user, name)
  const version = config.version + 1

  for await (const [id, data] of entries) {
    if (data !== undefined) {
      await this.validateRecord(id, data)

      const dataPath = codec.path.encode(this.source, user, name, id)
      const processed = await attachmentStore.storeAttachments(dataPath, data)
      const hash = await objectStore.write(processed)
      if (!snapshot.records[id] || !hash.equals(snapshot.records[id].hash)) {
        snapshot.records[id] = { hash, version, changed: Date.now() }
      }
    } else {
      delete snapshot.records[id]
    }
  }

  await this.writeVersion(user, name, snapshot)

  return snapshot.records
}

// get hash addressed object store for this dataset
exports.getObjectStore = function (user, name) {
  const blob = require('./file/blob').instance({
    extension: '.cbor',
    codec: codec.cbor,
    rootPath: this.path(user, name, 'objects')
  })
  return blob
}

// get file store, sandboxed in to user's dataset folder
exports.getFileStore = function (user, name) {
  const file = require('./file/cbor').instance({
    rootPath: this.path(user, name)
  })
  return file
}

/** does garbage collection tasks, like removing any orphaned objects from disk storage
 * @param {string} user - dataset/lens owner
 * @param {string} name - dataset/lens name
 * @async
 */
exports.garbageCollect = async function (user, name) {
  const snapshot = await this.readVersion(user, name)
  const hashes = Object.values(snapshot.records).map(x => x.hash)
  const objectStore = this.getObjectStore(user, name)
  const fileStore = this.getFileStore(user, name)

  // remove dereferenced objects
  for await (const objectHash of objectStore.iterate()) {
    if (!hashes.some(x => objectHash.equals(x))) {
      await objectStore.delete(objectHash)
    }
  }

  // remove any versions older than 1 month
  const cutoff = Date.now() - (1000 * 60 * 60 * 24 * 30)
  let version = snapshot.version - 1
  while (version > -1) {
    const oldSnap = await this.readVersion(user, name, version)
    if (!oldSnap) return
    if (oldSnap.created < cutoff) await fileStore.delete(['versions', `${version}`])
    version = oldSnap.version - 1
  }
}
