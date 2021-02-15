/**
 * Dataset Model - provides access to a dataset stored on the service
 */
const file = require('./cbor-file')
const attachmentStore = require('./attachment-storage')
const codec = require('./codec')
const auth = require('./auth')
const { default: PQueue } = require('p-queue')

// queue to handle writes
const queue = new PQueue({ concurrency: 1 })

module.exports = {
  // resolve dataset paths
  path (user, ...path) {
    return [...auth.userFolder(user), 'datasets', ...path]
  },

  /** read an entry from a dataset
   * @param {string} username - user who owns dataset
   * @param {string} dataset - name of dataset
   * @param {string} recordID - the dataset record's name
   * @returns {object} - parsed dataset record data
   * @async
   */
  async readEntry (user, dataset, recordID) {
    const hash = await this.readEntryHash(user, dataset, recordID)
    return await this.readEntryByHash(user, dataset, hash)
  },

  /** read an entry's hash from this dataset
   * @param {string} username - user who owns dataset
   * @param {string} dataset - name of dataset
   * @param {string} recordID - the dataset record's name
   * @returns {Buffer} - hash of recordID's object contents
   * @async
   */
  async readEntryHash (user, dataset, recordID) {
    const index = await queue.add(() => file.read(this.path(user, dataset, 'index')))
    if (!index[recordID]) throw new Error('Dataset doesn’t contain specified record')
    return index[recordID][1]
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
    return await queue.add(() => file.read(this.path(user, name, 'objects', hash.toLowerCase())))
  },

  /** reads each record of this dataset sequentially as an async iterator
   * @param {string} user - user who owns dataset
   * @param {string} name - name of dataset
   * @param {number} afterVersion - don't read anything below this version number
   * @yields {Array} - [recordID string, recordData any, hash Buffer, version number]
   */
  async * iterateEntries (user, name, afterVersion = 0) {
    const index = await queue.add(() => file.read(this.path(user, name, 'index')))
    for (const [recordID, [version, hash]] of Object.entries(index)) {
      if (version > afterVersion) {
        const recordData = await this.readEntryByHash(user, name, hash)
        yield [recordID, recordData, hash, version]
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
    return await this.merge(user, name, [[recordID, data]])
  },

  /** delete an entry from a dataset
   * @param {string} user - user who owns dataset
   * @param {string} name - name of dataset
   * @param {string} recordID - the dataset record's name
   * @async
   */
  async deleteEntry (user, name, recordID) {
    await queue.add(async () => {
      const path = await this.path(user, name, 'index')
      const index = await file.read(path)
      delete index[recordID]
      await file.write(path, index)
    })
    await this.garbageCollect(user, name)
  },

  /** list all the recordIDs in a dataset
   * @param {string} username - user who owns dataset
   * @param {string} dataset - name of dataset
   * @returns {string[]} - dataset entry id's
   * @async
   */
  async listEntries (user, dataset) {
    return Object.keys(await this.listEntryHashes(user, dataset))
  },

  /** plain object mapping recordIDs to object hashes
   * @param {string} user - user who owns dataset
   * @param {string} name - name of dataset or lens
   * @returns {object} - keyed with recordIDs and values are buffers containing hashes for each record's value
   * @async
   */
  async listEntryHashes (user, name) {
    return Object.fromEntries(Object.entries(await queue.add(() => file.read(this.path(user, name, 'index')))).map(([key, value]) => {
      return [key, value[1]]
    }))
  },

  /** get an integer version number for the current version of the dataset
   * every merge increments the number by one
   * @returns {number}
   */
  async getCurrentVersionNumber (user, name) {
    const values = Object.values(await queue.add(() => file.read(this.path(user, name, 'index'))))
    return values.reduce((a, b) => Math.max(a, b), 0)
  },

  /** hash the state of the whole dataset quickly
   * @param {string} user - owner of dataset
   * @param {string} name - name of dataset or lens
   */
  async getCollectionHash (user, name) {
    return codec.objectHash(await this.listEntryHashes(user, name))
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
    const output = []
    for await (const datasetName of this.iterateDatasets(user)) {
      output.push(datasetName)
    }
    return output
  },

  /** validates config object for dataset/lens is valid
   * @returns {boolean}
   */
  async validateConfig (config) {
    console.assert(typeof config.memo === 'string', 'memo must be a string')
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

    await this.validateConfig(config)

    await queue.add(() => Promise.all([
      file.write(this.path(user, name, 'config'), { created: Date.now(), ...config }),
      file.write(this.path(user, name, 'index'), {})
    ]))
  },

  /** read config of existing dataset
   * @param {string} username - string username
   * @param {string} dataset - string name of dataset
   * @returns {object}
   * @async
   */
  async readConfig (user, name) {
    return {
      ...await queue.add(() => file.read(this.path(user, name, 'config'))),
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
    await queue.add(() => file.write(this.path(user, dataset, 'config'), configData))
  },

  /** delete a dataset to from user's data folder
   * @param {string} username - string username
   * @param {string} dataset - string name of dataset
   * @async
   */
  async delete (user, dataset) {
    await queue.add(() => file.delete(this.path(user, dataset)))
  },

  /** overwrite all the entries in a dataset, removing any straglers
   * @param {string} username - user who owns dataset
   * @param {string} dataset - name of dataset
   * @param {Iterable} entries - (optically async) iterable that outputs an array with two elements, first a string entry name, second an object value
   * @async
   */
  async overwrite (user, dataset, entries) {
    await queue.add(() => file.write(this.path(user, dataset, 'index'), {}))
    return await this.merge(user, dataset, entries)
  },

  /** overwrite all the listed entries in a dataset, leaving any unmentioned entries in tact
   * @param {string} user - user who owns dataset
   * @param {string} name - name of dataset/lens
   * @param {Iterable} entries - (optically async) iterable that outputs an array with two elements, first a string entry name, second an object value
   * @returns {string[]} - recordIDs were updated
   * @async
   */
  async merge (user, name, entries) {
    const updatedIDs = []
    await queue.add(async () => {
      const indexPath = this.path(user, name, 'index')
      const index = await file.read(indexPath)
      const lastVersion = Object.values(index).reduce((a, b) => Math.max(a[0], b[0]), 0)

      for await (const [id, data] of entries) {
        if (!(typeof id === 'string')) throw new Error('Record ID must be a string')
        if (id.length < 1) throw new Error('Record ID must be at least one character long')
        if (id.length > 250) throw new Error('Record ID must be less than 250 characters long')

        const hash = await this.writeObject(user, name, data)
        updatedIDs.push(id)

        index[id] = [lastVersion + 1, hash]
      }

      await file.write(indexPath, index)
    })

    // do garbage collection
    await this.garbageCollect(user, name)

    return updatedIDs
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
    const references = Object.values(await this.listEntryHashes(user, name))
    for await (const objectHash of this.listObjects(user, name)) {
      if (!references.some(x => x.equals(objectHash))) {
        await this.deleteObject(user, name, objectHash)
      }
    }
  }
}
