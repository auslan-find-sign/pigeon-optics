/**
 * Dataset Model - provides access to a dataset stored on the service
 */
const file = require('./cbor-file')
const attachmentStore = require('./attachment-storage')
const codec = require('./codec')
const auth = require('./auth')
const queueify = require('../utility/queueify')
const itToArray = require('../utility/async-iterable-to-array')
const assert = require('assert')

function validateRecord (id, data) {
  assert(typeof id === 'string', 'recordID must be a string')
  assert(id !== '', 'recordID must not be empty')
  assert(id.length <= 10000, 'recordID cannot be longer than 10 thousand characters')
  assert(data !== undefined, 'record data cannot be set to undefined, use delete operation instead')
}

module.exports = queueify.object({
  // resolve dataset paths
  path (user, ...path) { return [...auth.userFolder(user), 'datasets', ...path] },

  // version path stuff
  versionPath (user, name, version) { return this.path(user, name, 'versions', `${version}`) },

  // read a version state info, a frozen representation of everything about the dataset's contents at that moment in time
  async readVersion (user, name, version = null) {
    if (version === null) version = (await this.readConfig(user, name)).version
    const path = this.versionPath(user, name, version)
    if (await file.exists(path)) {
      return await file.read(path)
    } else {
      return undefined
    }
  },

  // write a new version of the dataset
  async writeVersion (user, name, snapshot) {
    const config = (await this.readConfig(user, name))
    config.version += 1

    snapshot.created = Date.now()
    snapshot.version = config.version
    for (const id in snapshot.records) {
      if (!('version' in snapshot.records[id])) snapshot.records[id].version = snapshot.version
    }

    const path = this.versionPath(user, name, config.version)
    await file.write(path, snapshot)
    await this.writeConfig(user, name, config)
    return snapshot
  },

  /** read an entry from a dataset
   * @param {string} user - user who owns dataset
   * @param {string} name - name of dataset
   * @param {string} recordID - the dataset record's name
   * @param {number} [version] - optional version to read from
   * @returns {object} - parsed dataset record data
   * @async
   */
  async readEntry (user, name, recordID, version = null) {
    const info = await this.readEntryMeta(user, name, recordID, version)
    if (!info) return undefined
    return await this.readEntryByHash(user, name, info.hash)
  },

  /** read an entry's version and hash from this dataset
   * @param {string} user - user who owns dataset
   * @param {string} name - name of dataset
   * @param {string} recordID - the dataset record's name
   * @param {number} [version] - optional version to read from
   * @returns {Object} { version: int, hash: Buffer[32] }
   * @async
   */
  async readEntryMeta (user, name, recordID, version = null) {
    const snapshot = this.readVersion(user, name, version)
    return snapshot.records[recordID]
  },

  /** read an entry from a dataset
   * @param {string} user - user who owns dataset
   * @param {string} name - name of dataset
   * @param {Buffer|string} hash - the dataset's object hash
   * @returns {object} - parsed dataset record data
   * @async
   */
  async readEntryByHash (user, name, hash) {
    if (Buffer.isBuffer(hash)) hash = hash.toString('hex')
    return await file.read(this.path(user, name, 'objects', hash.toLowerCase()))
  },

  /** reads each record of this dataset sequentially as an async iterator
   * @param {string} user - user who owns dataset
   * @param {string} name - name of dataset
   * @param {function} filter - optional filter function, gets { id, version, hash } object as arg, boolean return decides if iterator loads and outputs this result
   * @yields {Array} - { id: "recordID", data: {any}, hash: Buffer[32], version: {number} }
   */
  async * iterateEntries (user, name, filter = null) {
    const snapshot = await this.readVersion(user, name)
    for (const [id, { version, hash }] of Object.entries(snapshot.records)) {
      if (!filter || filter({ id, version, hash })) {
        const data = await this.readEntryByHash(user, name, hash)
        yield { id, data, hash, version }
      }
    }
  },

  /** write an entry to a dataset
   * @param {string} username - user who owns dataset
   * @param {string} name - name of dataset
   * @param {string} recordID - the dataset record's name
   * @param {object} data - record data
   * @async
   */
  async writeEntry (user, name, recordID, data) {
    validateRecord(recordID, data)

    const snapshot = await this.readVersion(user, name)
    const hash = await this.writeObject(user, name, data)
    snapshot.records[recordID] = { hash, version: snapshot.version + 1 }
    await this.writeVersion(user, name, snapshot)
    return snapshot.records[recordID]
  },

  /** delete an entry from a dataset
   * @param {string} user - user who owns dataset
   * @param {string} name - name of dataset
   * @param {string} recordID - the dataset record's name
   * @async
   */
  async deleteEntry (user, name, recordID) {
    const snapshot = await this.readVersion(user, name)
    if (snapshot.records[recordID]) {
      delete snapshot.records[recordID]
      await this.writeVersion(user, name, snapshot)
    }
  },

  /** list all the recordIDs in a dataset
   * @param {string} user - user who owns dataset
   * @param {string} name - name of dataset
   * @returns {string[]} - dataset entry id's
   * @async
   */
  async listEntries (user, name) {
    return Object.keys(await this.listEntryMeta(user, name))
  },

  /** plain object mapping recordIDs to object hashes
   * @param {string} user - user who owns dataset
   * @param {string} name - name of dataset or lens
   * @returns {object} - keyed with recordIDs and values are { version: num, hash: Buffer[32] }
   * @async
   */
  async listEntryMeta (user, name) {
    const snapshot = await this.readVersion(user, name)
    return snapshot.records
  },

  /** get an integer version number for the current version of the dataset
   * every merge increments the number by one
   * @returns {number}
   */
  async getCurrentVersionNumber (user, name) {
    const config = await this.readConfig(user, name)
    return config.version
  },

  /** hash the state of the whole dataset quickly
   * @param {string} user - owner of dataset
   * @param {string} name - name of dataset or lens
   */
  async getCollectionHash (user, name) {
    return codec.objectHash(await this.readVersion(user, name))
  },

  /** tests if a dataset or specific record exists */
  async exists (user, name, recordID = undefined) {
    if (recordID === undefined) {
      return file.exists(this.path(user, name, 'index'))
    } else {
      return (await this.listEntries(user, name)).includes(recordID)
    }
  },

  /** iterates all datasets owned by a user
   * @param {string} username - user who owns dataset
   * @yields {string} dataset name
   * @async
   */
  async * iterateDatasets (user) {
    for await (const dataset of file.listFolders(this.path(user))) {
      yield dataset
    }
  },

  /** returns an array of all datasets owned by a user
   * @param {string} username - user who owns dataset
   * @returns {string[]} - dataset names
   * @async
   */
  async listDatasets (user) {
    return await itToArray(this.iterateDatasets(user))
  },

  /** validates config object for dataset/lens is valid
   * @returns {boolean}
   */
  async validateConfig (config) {
    console.assert(typeof config.memo === 'string', 'memo must be a string')
    console.assert(typeof config.version === 'number', 'version must be a number')
  },

  /** create a dataset with a specific name
   * @param {string} user - string username
   * @param {string} name - string name of dataset
   * @param {object} config - object that conains memo field and stuff like that, dataset user settings
   * @async
   */
  async create (user, name, config = {}) {
    if (!name.match(/^[^!*'();:@&=+$,/?%#[\]]+$/i)) {
      throw new Error('Name must not contain any of ! * \' ( ) ; : @ & = + $ , / ? % # [ ]')
    }

    if (name.length < 1) {
      throw new Error('Name cannot be empty')
    }

    if (name.length > 60) {
      throw new Error('Name must be less than 60 characters long')
    }

    if (await file.exists(this.path(user, name))) {
      throw new Error('This name already exists')
    }

    config.version = 0
    config.garbageCollect = true
    config.create = Date.now()

    await this.validateConfig(config)

    await file.write(this.path(user, name, 'config'), config)
    await file.write(this.versionPath(user, name, 0), { version: 0, records: {}, created: Date.now() })
  },

  /** read config of existing dataset
   * @param {string} username - string username
   * @param {string} dataset - string name of dataset
   * @returns {object}
   * @async
   */
  async readConfig (user, name) {
    return {
      ...await file.read(this.path(user, name, 'config')),
      user,
      name
    }
  },

  /** write config of existing dataset
   * @param {string} username - string username
   * @param {string} dataset - string name of dataset
   * @param {object} configData - object containing config data
   * @returns {object}
   * @async
   */
  async writeConfig (user, dataset, configData) {
    await this.validateConfig(configData)
    await file.write(this.path(user, dataset, 'config'), configData)
  },

  /** delete a dataset to from user's data folder
   * @param {string} username - string username
   * @param {string} dataset - string name of dataset
   * @async
   */
  async delete (user, dataset) {
    await file.delete(this.path(user, dataset))
  },

  /** overwrite all the entries in a dataset, removing any straglers
   * @param {string} username - user who owns dataset
   * @param {string} name - name of dataset
   * @param {Iterable} entries - (optically async) iterable that outputs an array with two elements, first a string entry name, second an object value
   * @async
   */
  async overwrite (user, name, entries) {
    const config = await this.readConfig(user, name)
    const version = config.version + 1

    const records = {}
    for await (const [id, data] of entries) {
      validateRecord(id, data)
      const hash = await this.writeObject(user, name, data)
      records[id] = { hash, version, changed: Date.now() }
    }

    await this.writeVersion(user, name, { records })

    if (config.garbageCollect) await this.garbageCollect(user, name)

    return records
  },

  /** overwrite all the listed entries in a dataset, leaving any unmentioned entries in tact
   * @param {string} user - user who owns dataset
   * @param {string} name - name of dataset/lens
   * @param {Iterable} entries - (optically async) iterable that outputs an array with two elements, first a string entry name, second an object value
   * @returns {object} - version records data
   * @async
   */
  async merge (user, name, entries) {
    const config = await this.readConfig(user, name)
    const snapshot = await this.readVersion(user, name)
    const version = config.version + 1

    for await (const [id, data] of entries) {
      if (data !== undefined) {
        validateRecord(id, data)

        const hash = await this.writeObject(user, name, data)
        if (!snapshot.records[id] || !hash.equals(snapshot.records[id])) {
          snapshot.records[id] = { hash, version, changed: Date.now() }
        }
      } else {
        delete snapshot.records[id]
      }
    }

    await this.writeVersion(user, name, snapshot)

    if (config.garbageCollect) await this.garbageCollect(user, name)

    return snapshot.records
  },

  /** list's objects in a dataset/lens output
   * @yields {Buffer} hash
  */
  async * listObjects (user, name) {
    for await (const objectID of file.list(this.path(user, name, 'objects'))) {
      yield Buffer.from(objectID, 'hex')
    }
  },

  /** writes an object to a dataset/lens output's storage */
  async writeObject (user, name, object) {
    const processedObject = await attachmentStore.storeAttachments(object)
    const hash = codec.objectHash(processedObject)
    const path = this.path(user, name, 'objects', hash.toString('hex').toLowerCase())
    if (!await file.exists(path)) {
      await file.write(path, processedObject)
    }
    return hash
  },

  async readObject (user, name, hash) {
    return await file.read(this.path(user, name, 'objects', hash.toString('hex').toLowerCase()))
  },

  async deleteObject (user, name, hash) {
    await file.delete(this.path(user, name, 'objects', hash.toString('hex').toLowerCase()))
  },

  /** does garbage collection tasks, like removing any orphaned objects from disk storage
   * @param {string} user - dataset/lens owner
   * @param {string} name - dataset/lens name
   * @async
   */
  async garbageCollect (user, name) {
    // remove dereferenced objects
    const snapshot = await this.readVersion(user, name)
    const hashes = Object.values(snapshot.records).map(x => x.hash)
    for await (const objectHash of this.listObjects(user, name)) {
      if (!hashes.some(x => objectHash.equals(x))) {
        await this.deleteObject(user, name, objectHash)
      }
    }

    // remove any versions older than 1 month
    const cutoff = Date.now() - (1000 * 60 * 60 * 24 * 30)
    let version = snapshot.version - 1
    while (version > -1) {
      const oldSnap = await this.readVersion(user, name, version)
      if (!oldSnap) return
      if (oldSnap.created < cutoff) {
        await file.delete(this.versionPath(user, name, version))
        version = oldSnap.version - 1
      }
    }
  }
})
