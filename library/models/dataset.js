/**
 * Dataset Model - provides access to a dataset stored on the service
 */
const file = require('./cbor-file')
const codec = require('./codec')
const auth = require('./auth')
const { default: PQueue } = require('p-queue')

// queue to handle writes
const queue = new PQueue({ concurrency: 1 })

module.exports = {
  // resolve dataset paths
  path (user, ...path) {
    return `${auth.userFolder(user)}/datasets${path.map(x => `/${encodeURIComponent(x)}`).join('')}`
  },

  /** read an entry from a dataset
   * @param {string} username - user who owns dataset
   * @param {string} dataset - name of dataset
   * @param {string} recordID - the dataset record's name
   * @returns {object} - parsed dataset record data
   * @async
   */
  async readEntry (user, dataset, recordID) {
    const index = queue.add(() => file.read(this.path(user, dataset, 'index')))
    if (!index[recordID]) throw new Error('Dataset doesn’t contain specified record')
    return await queue.add(() => file.read(this.path(user, dataset, 'objects', index[recordID].toString('hex'))))
  },

  /** write an entry to a dataset
   * @param {string} username - user who owns dataset
   * @param {string} dataset - name of dataset
   * @param {string} entryID - the dataset record's name
   * @param {object} data - record data
   * @async
   */
  async writeEntry (user, dataset, entryID, data) {
    return await this.merge(user, dataset, [entryID, data])
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

  /** list all the entries in a dataset
   * @param {string} username - user who owns dataset
   * @returns {string[]} - dataset names
   * @async
   */
  async listDatasets (user) {
    return await file.list(this.path(user)).map(x => decodeURIComponent(x))
  },

  /** create a dataset with a specific name
   * @param {string} username - string username
   * @param {string} dataset - string name of dataset
   * @async
   */
  async create (user, dataset, config = {}) {
    if (await file.exists(this.path(user, dataset))) throw new Error('Dataset with this name already exists')
    await queue.add(() => Promise.all(
      file.write(this.path(user, dataset, 'config'), { created: Date.now(), ...config }),
      file.write(this.path(user, dataset, 'index'), {})
    ))
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
    const updatedIDs = []
    const idMapRewrites = {}

    for await (const [id, data] of entries) {
      const hash = codec.objectHash(data)
      await queue.add(() => file.write(this.path(user, dataset, 'objects', hash.toString('hex')), data))
      updatedIDs.push(id)
      idMapRewrites[id] = hash
    }

    // update the index
    await queue.add(async () => {
      const path = this.path(user, dataset, 'index')
      await file.write(path, {
        ...(await file.read(path)),
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
      const index = await queue.add(() => file.read(this.path(user, dataset, 'index')))
      const objectList = await queue.add(() => file.list(this.path(user, dataset, 'objects')))
      const keepObjects = Object.values(index).map(x => x.toString('hex'))
      await Promise.all(
        objectList.filter(objectID =>
          !keepObjects.includes(objectID)
        ).map(objectID =>
          file.delete(this.path(user, dataset, 'objects', objectID))
        )
      )
    })
  }
}
