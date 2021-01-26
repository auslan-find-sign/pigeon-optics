const express = require('express')
const router = express.Router()
const streamqueue = require('streamqueue')
const streamFromPromise = require('stream-from-promise')
const codec = require('../models/codec')
const dataset = require('../models/dataset')
const ui = require('../ui')
const serverTools = require('../server-tools')
const { pipeline } = require('stream')

// get a list of datasets owned by a specific user
router.get('/users/:user/datasets/', async (req, res) => {
  const datasets = await dataset.listDatasets(req.params.user)

  if (req.accepts('html')) {
    // TODO: UI with html view
    res.send('Not yet implemented')
  } else if (req.accepts('application/cbor')) {
    res.type('application/cbor').send(codec.cbor.encode(datasets))
  } else if (req.accepts('json')) {
    res.type('json').send(codec.json.encode(datasets))
  }
})

// get a list of records owned by a user's dataset
router.get('/users/:user/datasets/:dataset/records/', async (req, res) => {
  const entryIDs = await dataset.listEntries(req.params.user, req.params.dataset)

  if (req.accepts('html')) {
    // TODO: UI with html view
    res.send('Not yet implemented')
  } else if (req.accepts('application/cbor')) {
    res.type('application/cbor').send(codec.cbor.encode(entryIDs))
  } else if (req.accepts('json')) {
    res.type('json').send(codec.json.encode(entryIDs))
  }
})

// get a record from a user's dataset
router.get('/users/:user/datasets/:dataset/records/:entry', async (req, res) => {
  const record = await dataset.readEntry(req.params.user, req.params.dataset, req.params.entry)

  if (req.accepts('html')) {
    serverTools.sendWebpage(req, res, {
      title: 'Form Information Recieved',
      contents: ui.noticePanel({
        title: `Record ID: ${req.params.entry}`,
        contents: ui.sourceCode({ contents: `${codec.json.encode(record, 2)}` })
      })
    })
  } else if (req.accepts('application/cbor')) {
    res.type('application/cbor')
    res.send(codec.cbor.encode(record))
  } else if (req.accepts('json')) {
    res.type('json')
    res.send(codec.json.encode(record))
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
    const encoder = async (entryID, last) => {
      const entry = await dataset.readEntry(req.params.user, req.params.dataset, entryID)
      let line = `${codec.json.encode(entryID)}:${codec.json.encode(entry)}`
      if (!last) line += ','
      return streamFromPromise(Buffer.from(line))
    }

    const queue = streamqueue([
      streamFromPromise(async () => '{'),
      ...entryIDs.map((id, index) => encoder(id, index === (entryIDs.length - 1))),
      streamFromPromise(async () => '}')
    ])
    res.type('application/json')
    pipeline(queue, res)
  } else {
    return res.status(500).send('Unsupported encoding')
  }
})

module.exports = router
