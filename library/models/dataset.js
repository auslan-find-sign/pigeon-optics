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

  /** read an entry from a dataset
   * @param {string} username - user who owns dataset
   * @param {string} dataset - name of dataset
   * @param {Buffer|string} hash - the dataset's object hash
   * @returns {object} - parsed dataset record data
   * @async
   */
  async readEntryByHash (user, dataset, hash) {
    if (Buffer.isBuffer(hash)) hash = hash.toString('hex')
    return await queue.add(() => file.read(this.path(user, dataset, 'objects', hash)))
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
    return index[recordID]
  },

  /** reads each record of this dataset sequentially as an async iterator
   * @param {string} username - user who owns dataset
   * @param {string} dataset - name of dataset
   * @yields {Array} - [recordID string, recordData any, hash Buffer]
   */
  async * iterateEntries (user, dataset) {
    const index = await queue.add(() => file.read(this.path(user, dataset, 'index')))
    for (const [recordID, hash] of Object.entries(index)) {
      const recordData = await queue.add(() => file.read(this.path(user, dataset, 'objects', index[recordID].toString('hex'))))
      yield [recordID, recordData, hash]
    }
  },

  /** write an entry to a dataset
   * @param {string} username - user who owns dataset
   * @param {string} dataset - name of dataset
   * @param {string} recordID - the dataset record's name
   * @param {object} data - record data
   * @async
   */
  async writeEntry (user, dataset, recordID, data) {
    return await this.merge(user, dataset, [[recordID, data]])
  },

  /** delete an entry from a dataset
   * @param {string} username - user who owns dataset
   * @param {string} dataset - name of dataset
   * @param {string} recordID - the dataset record's name
   * @async
   */
  async deleteEntry (user, dataset, recordID) {
    await queue.add(async () => {
      const path = await this.path(user, dataset, 'index')
      const index = await file.read(path)
      delete index[recordID]
      await file.write(path, index)
    })
    await this.garbageCollect(user, dataset)
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
   * @param {string} username - user who owns dataset
   * @param {string} dataset - name of dataset
   * @returns {string[]} - dataset entry id's
   * @async
   */
  async listEntryHashes (user, dataset) {
    return await queue.add(() => file.read(this.path(user, dataset, 'index')))
  },

  /** tests if a dataset or specific record exists */
  async exists (user, dataset, recordID = undefined) {
    if (recordID === undefined) {
      return file.exists(this.path(user, dataset, 'index'))
    } else {
      return (await this.listEntries(user, dataset)).includes(recordID)
    }
  },

  /** iterates all datasets owned by a user
   * @param {string} username - user who owns dataset
   * @yields {string} - dataset name
   * @async
   */
  async * iterateDatasets (user) {
    for (const dataset of file.listFolders(this.path(user))) {
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
   * @param {string} username - string username
   * @param {string} dataset - string name of dataset
   * @async
   */
  async create (user, dataset, config = {}) {
    if (!dataset.match(/^[^!*'();:@&=+$,/?%#[\]]+$/i)) {
      throw new Error('Name must not contain any of ! * \' ( ) ; : @ & = + $ , / ? % # [ ]')
    }

    if (dataset.length < 1) {
      throw new Error('Name cannot be empty')
    }

    if (dataset.length > 60) {
      throw new Error('Name must be less than 60 characters long')
    }

    if (await file.exists(this.path(user, dataset))) {
      throw new Error('This name already exists')
    }

    await this.validateConfig(config)

    await queue.add(() => Promise.all([
      file.write(this.path(user, dataset, 'config'), { created: Date.now(), ...config }),
      file.write(this.path(user, dataset, 'index'), {})
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
   * @param {string} username - user who owns dataset
   * @param {string} dataset - name of dataset
   * @param {Iterable} entries - (optically async) iterable that outputs an array with two elements, first a string entry name, second an object value
   * @returns {string[]} - entry labels that were updated
   * @async
   */
  async merge (user, dataset, entries) {
    let updatedIDs = []
    const idMapRewrites = {}

    for await (const [id, data] of entries) {
      if (!(typeof id === 'string')) throw new Error('Record ID must be a string')
      if (id.length < 1) throw new Error('Record ID must be at least one character long')
      if (id.length > 250) throw new Error('Record ID must be less than 250 characters long')

      const processedData = await attachmentStore.storeAttachments(data)
      const hash = codec.objectHash(processedData)
      await queue.add(() => file.write(this.path(user, dataset, 'objects', hash.toString('hex')), processedData))
      updatedIDs.push(id)
      idMapRewrites[id] = hash
    }

    // update the index
    await queue.add(async () => {
      const path = this.path(user, dataset, 'index')
      const index = await file.read(path)
      // remove any elements from updatedIDs where the data didn't actually change
      updatedIDs = Object.entries(idMapRewrites).filter(([id, hash]) => !index[id] || hash.equals(index[id])).map(x => x[0])
      await file.write(path, {
        ...index,
        ...idMapRewrites
      })
    })

    // do garbage collection
    await this.garbageCollect(user, dataset)

    return updatedIDs
  },

  /** does garbage collection tasks, like removing any orphaned objects from disk storage
   * @param {string} username - dataset owner
   * @param {string} dataset - dataset name
   * @async
   */
  async garbageCollect (user, dataset) {
    await queue.add(async () => {
      const index = await file.read(this.path(user, dataset, 'index'))
      const keepObjects = Object.values(index).map(x => x.toString('hex'))
      for await (const objectID of file.list(this.path(user, dataset, 'objects'))) {
        if (!keepObjects.includes(objectID)) {
          await file.delete(this.path(user, dataset, 'objects', objectID))
        }
      }
    })
  }
}
