/**
 * Viewports are instances of lenses which are established and exist on the system. Viewports run
 * automatically and have a precomputed output that is written to disk. Viewport outputs exist
 * in the changelog and can be used as inputs to other viewports or potentially monitored by external
 * observers for changes
 */
const auth = require('./auth')
const jsLens = require('./javascript-lens')
const file = require('./cbor-file')
const codec = require('./codec')
// const webhook = require('../workers/webhook')
const dataset = require('./dataset')
const readPath = require('./read-path')
// const defaults = require('../../package.json').defaults
// const PQueue = require('p-queue').default

// const ioMapQueue = new PQueue({ concurrency: 1 })

module.exports = {
  ...dataset, // import dataset functions

  // resolve path inside this - override with viewports path in user folder
  path (user, ...path) {
    return `${auth.userFolder(user)}/viewports${path.map(x => `/${encodeURIComponent(x)}`).join('')}`
  },

  // (re)build a specified viewport
  async build (user, viewport) {
    const config = await this.readConfig(user, viewport)
    const resultsMap = {}

    // run the map over the whole dataset, transforming to map output objects on disk
    const mapFn = jsLens.loadMap(config.lens.user, config.lens.name)
    const inputFeed = readPath(config.input)
    for await (const { outputs, dependencies } of mapFn(inputFeed)) {
      for (const [recordID, recordData] of outputs) {
        const hash = codec.objectHash(recordData)
        await file.write(this.path(user, viewport, 'map-output', hash.toString('hex')), recordData)
        if (!resultsMap[recordID]) resultsMap[recordID] = []
        resultsMap[recordID].push(hash)
      }
    }

    // reduce the results using the merge function in to entries in this viewport dataset
    const mergeFn = jsLens.loadMerge(config.lens.user, config.lens.name)
    async function * entryIter () {
      const read = async (hash) => file.read(this.path(user, viewport, 'map-output', hash.toString('hex')))
      for (const [recordID, recordHashList] of Object.entries(resultsMap)) {
        let recordData = read(recordHashList.shift())
        while (recordHashList.length) {
          recordData = await mergeFn(recordData, read(recordHashList.shift()))
        }
        yield [recordID, recordData]
      }
    }

    await this.overwrite(user, viewport, entryIter())
  }//,

  // io-map is an object with dataPath keys and objectHash values of what inputs resulted in these outputs
  // async readIOMap (user, viewport) {
  //   return await ioMapQueue.add(x => file.read(this.path(user, viewport, 'io-map')))
  // },

  // async writeIOMap (user, viewport, data) {
  //   return await ioMapQueue.add(x => file.write(this.path(user, viewport, 'io-map', data)))
  // },

  // async getInputs () {
  //   const inputMap = {}
  //   for await (const user of auth.listUsers()) {
  //     for await (const viewport of this.listDatasets(user)) {
  //       const { inputs } = await this.readConfig(user, viewport)
  //       for (const input of inputs) {
  //         if (!inputMap[input]) inputMap[input] = []
  //         inputMap[input] = [user, viewport]
  //       }
  //     }
  //   }
  //   return inputMap
  // },

  // given an array of [dataPath, currentHash] entries, processes downstream viewports
  // async processFeedEntry (dataPaths) {
  //   const inputMap = Object.entries(await this.getInputs())
  //   for (const [dataPath, currentHash] of dataPaths) {
  //     const listeningViewports = inputMap.filter(([path]) => dataPath.beginsWith(path)).map(x => x[1])
  //     for (const [user, viewport] of listeningViewports) {
  //       const config = this.readConfig(user, viewport)
  //       if (config.type === 'javascript') {
  //         const mapFn = jsLens.loadMap(config.jsLens.user, config.jsLens.name)

  //       }
  //     }
  //   }
  // }
}
