/**
 * Lenses are code which runs  run
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

Object.assign(module.exports, {
  ...dataset, // import dataset functions

  // resolve path inside this - override with viewports path in user folder
  path (user, ...path) {
    return `${auth.userFolder(user)}/viewports${path.map(x => `/${encodeURIComponent(x)}`).join('')}`
  },

  async validateConfig (config) {
    dataset.validateConfig(config)
    console.assert(typeof config.mapCode === 'string', 'map code must be a string')
    console.assert(typeof config.reduceCode === 'string', 'reduce code must be a string')
    console.assert(Array.isArray(config.inputs), 'inputs must be an array')
    console.assert(config.inputs.every(x => typeof x === 'string'), 'inputs entries must be strings')
    for (const input of config.inputs) {
      console.assert(await readPath.exists(input), `${input} doesn’t exist`)
    }
  },

  // (re)build a specified viewport
  async build (user, viewport) {
    const config = await this.readConfig(user, viewport)
    const resultsMap = {}

    // run the map over the whole dataset, transforming to map output objects on disk
    const mapFn = await jsLens.loadMap(config.lens.user, config.lens.name)

    // wrap it with a caching system so same hashed inputs skip running
    const path = this.path
    const usedInputHashKeys = [] // keep track of which cache entries are still in use in the output
    let mapOutputIndex = {}
    if (await file.exists(path(user, viewport, 'map-outputs', 'index'))) {
      mapOutputIndex = await file.read(path(user, viewport, 'map-outputs', 'index'))
    }
    async function * cacheMaps (inputs) {
      for await (const entry of inputs) {
        const inputHash = codec.objectHash(entry)
        const inputHashString = inputHash.toString('hex')
        if (mapOutputIndex[inputHashString]) {
          for (const [recordID, recordHash] of mapOutputIndex[inputHashString]) {
            if (!resultsMap[recordID]) resultsMap[recordID] = []
            resultsMap[recordID].push(recordHash)
          }
          usedInputHashKeys.push(inputHashString)
        } else {
          // if cache hit failed, yield the entry to the map function to process
          yield entry
        }
      }
    }

    for await (const { input, outputs } of mapFn(cacheMaps(readPath(config.inputs)))) {
      const inputHash = codec.objectHash(input)
      const inputHashString = inputHash.toString('hex')

      const indexEntry = mapOutputIndex[inputHashString] = []
      for (const [recordID, recordData] of outputs) {
        const recordHash = codec.objectHash(recordData)
        await file.write(this.path(user, viewport, 'map-output', recordHash.toString('hex')), recordData)
        indexEntry.push([recordID, recordHash])
        if (!resultsMap[recordID]) resultsMap[recordID] = []
        resultsMap[recordID].push(recordHash)
      }
    }

    // reduce the results using the merge function in to entries in this viewport dataset
    const mergeFn = await jsLens.loadMerge(config.lens.user, config.lens.name)
    async function * entryIter () {
      const read = async (hash) => file.read(module.exports.path(user, viewport, 'map-output', hash.toString('hex')))
      for (const [recordID, recordHashList] of Object.entries(resultsMap)) {
        let recordData = await read(recordHashList.shift())
        while (recordHashList.length) {
          recordData = await mergeFn(recordData, await read(recordHashList.shift()))
        }
        console.log('merging', recordID, recordData)
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
})
