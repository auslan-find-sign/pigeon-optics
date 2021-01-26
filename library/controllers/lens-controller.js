const express = require('express')
const router = express.Router()
const streamqueue = require('streamqueue')
const streamFromPromise = require('stream-from-promise')
const codec = require('../models/codec')
const dataset = require('../models/dataset')
const jsLens = require('../models/javascript-lens')
const ui = require('../ui')
const serverTools = require('../server-tools')
const { pipeline } = require('stream')

/**
 * Runs a lens chain, returning output datas
 * final element must be a dataset, all previous elements must be a lens
 * returns in Object.entries format an iterator that outputs [recordID, [recordDataObject, ...]]
 * @param {string} path - in the format user:lens/user:lens/user:dataset
 * @param {Array} inputs - optional, entryIDs from source dataset to lookup, defaults to everything in dataset
 */
async function * runLensChain (path, recordIDs = false) {
  const globals = {}
  const timeout = 10
  const steps = path.split('/')
  const [user, name] = steps[0].split(':')

  if (steps.length > 1) {
    // iterate next level through this lens
    const lens = await jsLens.load(user, name, globals, timeout)
    for await (const [entryID, entryData] of runLensChain(steps.slice(1).join('/'))) {
      // run user supplied lookup function
      let requests = lens.lookup(entryID, entryData)
      if (!requests) requests = []
      // do any requested lookups
      const lookups = await Promise.all(requests.map(x => x.split(':')).map(async ([user, name, record]) =>
        [`${user}:${name}:${record}`, await dataset.readEntry(user, name, record)]
      ))

      const output = lens.transform(entryID, entryData, Object.fromEntries(lookups))
      if (output) {
        if (Array.isArray(output)) {
          for (const [id, data] of output) {
            yield [id, data]
          }
        } else if (typeof output === 'object') {
          yield [entryID, output]
        }
      }
    }
  } else {
    // iterate dataset
    if (recordIDs === false) {
      recordIDs = await dataset.listEntries(user, name)
    }
    for (const recordID of recordIDs) {
      yield [`${user}:${name}:${recordID}`, [await dataset.readEntry(user, name, recordID)]]
    }
  }
}

// get a list of lenses owned by a specific user
router.get('/users/:user/lenses/', async (req, res) => {
  const lenses = await jsLens.list(req.params.user)

  if (req.accepts('html')) {
    // TODO: UI with html view
    res.send('Not yet implemented')
  } else if (req.accepts('application/cbor')) {
    res.type('application/cbor').send(codec.cbor.encode(lenses))
  } else if (req.accepts('json')) {
    res.type('json').send(codec.json.encode(lenses))
  }
})

// get a list of records owned by a user's dataset
router.get('/lens/:lensPath+', async (req, res) => {
  const lensPath = req.params.lensPath
  const recordIDs = req.query.id ? [req.query.id] : false
  const output = runLensChain(lensPath, recordIDs)

  if (req.accepts('html')) {
    const results = [...output]
    // TODO: UI with html view
    res.send('Not yet implemented')
  } else if (req.accepts('application/cbor') || req.query.encoding === 'cbor') {
    res.type('application/cbor').send(codec.cbor.encode(results))
  } else if (req.accepts('json') || req.query.encoding === 'json') {
    res.type('json').send(codec.json.encode(results))
  } else if (req.accepts('text/plain') || req.query.encoding === 'json-lines') {
    res.type('json').send(codec.json.encode(results))
  }
})

// export a dataset
// query string must specify encoding as one of the following:
//  - cbor: returns a cbor stream of arrays containing [entryID, entryData]
//  - json-lines: returns a text file, where each line is a json array in the same format as cbor, followed by newlines \n
//  - json: returns a json object where each key is an entryID and each value is entry data
// json-lines maybe easier to process with large datasets, as you can just read a line in at a time
router.get('/users/:user/datasets/:dataset/export', async (req, res) => {
  const entryIDs = dataset.listEntries(req.params.user, req.params.dataset)

  if (req.query.encoding === 'cbor') {
    const encoder = async (entryID) => {
      const entry = await dataset.readEntry(req.params.user, req.params.dataset, entryID)
      return streamFromPromise(codec.cbor.encode([entryID, entry]))
    }

    const queue = streamqueue(entryIDs.map(id => () => encoder(id)))
    res.type('application/cbor')
    pipeline(queue, res)
  } else if (req.query.encoding === 'json-lines') {
    const encoder = async (entryID) => {
      const entry = await dataset.readEntry(req.params.user, req.params.dataset, entryID)
      return streamFromPromise(Buffer.from(codec.json.encode([entryID, entry]) + '\n'))
    }

    const queue = streamqueue(entryIDs.map(id => () => encoder(id)))
    res.type('text/plain')
    pipeline(queue, res)
  } else if (req.query.encoding === 'json') {
    const encoder = async (entryID) => {
      const entry = await dataset.readEntry(req.params.user, req.params.dataset, entryID)
      const line = `  ${JSON.stringify(entryID)}: ${JSON.stringify(entry, jsonBufferEncode)}\n`
      return streamFromPromise(Buffer.from(line))
    }

    const queue = streamqueue([
      streamFromPromise(async () => '{'),
      ...entryIDs.map(id => () => encoder(id)),
      streamFromPromise(async () => '}')
    ])
    res.type('application/json')
    pipeline(queue, res)
  } else {
    return res.status(500).send('Unsupported encoding')
  }
})

module.exports = router
