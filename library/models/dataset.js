/**
 * Dataset Model - provides access to a dataset stored on the service
 */
const file = require('./cbor-file')
const objectHash = require('object-hash')
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
   * @param {string} entryID - the dataset record's name
   * @returns {object} - parsed dataset record data
   * @async
   */
  async readEntry (user, dataset, entryID) {
    return await file.read(this.path(user, dataset, 'records', entryID))
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
   * @param {string} entryID - the dataset record's name
   * @async
   */
  async deleteEntry (user, dataset, entryID) {
    return await file.delete(this.path(user, dataset, 'records', entryID))
  },

  /** list all the entries in a dataset
   * @param {string} username - user who owns dataset
   * @param {string} dataset - name of dataset
   * @returns {string[]} - dataset entry id's
   * @async
   */
  async listEntries (user, dataset) {
    return await file.list(this.path(user, dataset, 'records')).map(x => decodeURIComponent(x))
  },

  /** list all the entries in a dataset
   * @param {string} username - user who owns dataset
   * @returns {string[]} - dataset names
   * @async
   */
  async list (user) {
    return await file.list(this.path(user)).map(x => decodeURIComponent(x))
  },

  /** create a dataset with a specific name
   * @param {string} username - string username
   * @param {string} dataset - string name of dataset
   * @async
   */
  async create (user, dataset, config = {}) {
    await file.write(this.path(user, dataset, 'config'), { created: Date.now(), ...config })
    await file.write(this.path(user, dataset, 'hash-table'), {})
  },

  /** create a dataset with a specific name
   * @param {string} username - string username
   * @param {string} dataset - string name of dataset
   * @returns {object} - keys are entryIDs, values are object hashes
   * @async
   */
  async readHashTable (user, dataset) {
    return await file.read(this.path(user, dataset, 'hash-table'))
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
   * @param {string} dataset - name of dataset
   * @param {Iterable} entries - (optically async) iterable that outputs an array with two elements, first a string entry name, second an object value
   * @async
   */
  async overwrite (user, dataset, entries) {
    const updated = await this.merge(user, dataset, entries)
    const list = await this.listEntries(user, dataset)
    for (const id of list) {
      if (!updated.includes(id)) {
        await this.deleteEntry(user, dataset, id)
      }
    }
  },

  /** overwrite all the listed entries in a dataset, leaving any unmentioned entries in tact
   * @param {string} username - user who owns dataset
   * @param {string} dataset - name of dataset
   * @param {Iterable} entries - (optically async) iterable that outputs an array with two elements, first a string entry name, second an object value
   * @returns {string[]} - entry labels that were updated
   * @async
   */
  async merge (user, dataset, entries) {
    const updated = []
    await queue.add(async () => {
      let hashTable = {}
      if (await file.exists(this.path(user, dataset, 'hash-table'))) {
        hashTable = await file.read(this.path(user, dataset, 'hash-table'))
      }

      for await (const [id, data] of entries) {
        await file.write(this.path(user, dataset, 'records', id), data)
        hashTable[id] = objectHash(data, { algorithm: 'sha256', encoding: 'buffer' })
        updated.push(id)
      }

      await file.write(this.path(user, dataset, 'hash-table'), hashTable)
    })

    return updated
  },

  /** does garbage collection tasks, like clearing out unused hash-table entries
   * @async
   */
  async garbageCollect () {
    const users = await auth.listUsers()
    for (const user of users) {
      const datasets = this.list(user)
      for (const dataset of datasets) {
        if (await file.exists(this.path(user, dataset, 'hash-table'))) {
          await queue.add(async () => {
            const [hashTable, entryList] = await Promise.all([
              file.read(this.path(user, dataset, 'hash-table')),
              this.listEntries(user, dataset)
            ])

            const missing = Object.keys(hashTable).filter(x => !entryList.includes(x))
            for (const missingID of missing) {
              delete hashTable[missingID]
            }
            await file.write(this.path(user, dataset, 'hash-table'))
          })
        }
      }
    }
  }
}
