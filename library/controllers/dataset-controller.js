const express = require('express')
const router = express.Router()

const auth = require('../models/auth')
const codec = require('../models/codec')
const dataset = require('../models/dataset')
const uri = require('encodeuricomponent-tag')

const Vibe = require('../vibe/rich-builder')
const layout = require('../views/layout')
const editorView = require('../views/dataset-record-editor')
const configEditView = require('../views/dataset-config-editor')
const soloList = require('../views/solo-list')

router.get('/datasets/create', auth.required, (req, res) => {
  const state = {
    create: true
  }
  Vibe.docStream('Create a Dataset', configEditView(req, state)).pipe(res.type('html'))
})

router.post('/datasets/create', auth.required, async (req, res) => {
  try {
    await dataset.create(req.session.auth.user, req.body.name, {
      memo: req.body.memo
    })
  } catch (err) {
    const state = {
      create: true
    }
    Vibe.docStream('Create a Dataset', configEditView(req, state, err.message)).pipe(res.type('html'))
  }
})

// get a list of datasets owned by a specific user
router.get('/datasets/:user\\:', async (req, res) => {
  const datasets = await dataset.listDatasets(req.params.user)

  if (req.accepts('html')) {
    const title = `${req.params.user}’s Datasets`
    Vibe.docStream(title, soloList(req, title, datasets, (x) => uri`/datasets/${req.params.user}:${x}/`)).pipe(res.type('html'))
  } else {
    codec.respond(req, res, datasets)
  }
})

// list contents of dataset
router.get('/datasets/:user\\::dataset/', async (req, res) => {
  const config = await dataset.readConfig(req.params.user, req.params.dataset)

  if (req.accepts('html')) {
    const recordIDs = await dataset.listEntries(req.params.user, req.params.dataset)
    Vibe.docStream(`${req.params.user}’s “${req.params.dataset}” Datasets`, layout(req, v => {
      v.heading(`Dataset: ${req.params.dataset}`)
      if (config.memo) v.p(config.memo)
      v.heading('Records:', { level: 3 })
      v.linkList(recordIDs, id => uri`/datasets/${req.params.user}:${req.params.dataset}/${id}`)
    })).pipe(res.type('html'))
  } else {
    const records = await dataset.listEntryHashes(req.params.user, req.params.dataset)
    codec.respond(req, res, {
      owner: req.params.user,
      name: req.params.dataset,
      config,
      records: Object.fromEntries(Object.entries(records).map(([key, value]) => [uri`/datasets/${req.params.user}:${req.params.dataset}/${key}`, value]))
    })
  }
})

// get a record from a user's dataset
router.get('/datasets/:user\\::dataset/:recordID', async (req, res) => {
  try {
    const record = await dataset.readEntry(req.params.user, req.params.dataset, req.params.recordID)

    if (req.accepts('html')) {
      Vibe.docStream(`${req.params.user}:${req.params.dataset}/${req.params.recordID}`, layout(req, v => {
        v.heading(`Record ID: ${req.params.recordID}`)
        v.sourceCode(codec.json.encode(record, 2))
      })).pipe(res.type('html'))
    } else {
      codec.respond(req, res, record)
    }
  } catch (err) {
    codec.respond(req, res.status(404), { error: err.message })
  }
})

// UI to edit a record from a user's dataset
router.get('/datasets/:user\\::dataset/:recordID/edit', async (req, res) => {
  try {
    const record = await dataset.readEntry(req.params.user, req.params.dataset, req.params.recordID)

    const title = `Editing ${req.params.user}:${req.params.dataset}/${req.params.recordID}`
    const state = {
      create: false,
      recordID: req.params.recordID,
      recordData: codec.json.encode(record, 2)
    }
    Vibe.docStream(title, editorView(req, state)).pipe(res.type('html'))
  } catch (err) {
    codec.respond(req, res.status(404), { error: err.message })
  }
})

router.post('/datasets/:user\\::dataset/:recordID/save', auth.requireOwnerOrAdmin('user'), async (req, res) => {
  try {
    const data = codec.json.decode(req.body.recordData)
    await dataset.writeEntry(req.params.user, req.params.dataset, req.params.recordID, data)
    res.redirect(uri`/datasets/${req.params.user}:${req.params.dataset}/${req.params.recordID}`)
  } catch (error) {
    const title = `Editing ${req.params.user}:${req.params.dataset}/${req.params.recordID}`
    const state = {
      create: false,
      recordID: req.params.recordID,
      recordData: req.body.recordData
    }
    Vibe.docStream(title, editorView(req, state, error.message)).pipe(res.type('html'))
  }
})

router.post('/datasets/:user\\::dataset/:recordID/delete', auth.requireOwnerOrAdmin('user'), async (req, res) => {
  try {
    await dataset.deleteEntry(req.params.user, req.params.dataset, req.params.recordID)
    res.redirect(uri`/datasets/${req.params.user}:${req.params.dataset}/`)
  } catch (error) {
    const title = `Editing ${req.params.user}:${req.params.dataset}/${req.params.recordID}`
    const state = {
      create: true,
      recordID: req.params.recordID,
      recordData: req.body.recordData
    }
    Vibe.docStream(title, editorView(req, state, error.message)).pipe(res.type('html'))
  }
})

router.get('/datasets/create-record/:user\\::dataset/', auth.requireOwnerOrAdmin('user'), (req, res) => {
  const title = `Creating a record inside ${req.params.user}:${req.params.dataset}/`
  const state = {
    create: true,
    recordID: '',
    recordData: '{}'
  }
  Vibe.docStream(title, editorView(req, state)).pipe(res.type('html'))
})

// create a new record
router.post('/datasets/create-record/:user\\::dataset/save', auth.requireOwnerOrAdmin('user'), async (req, res) => {
  try {
    req.body.data = codec.json.decode(req.body.recordData)
    await dataset.writeEntry(req.params.user, req.params.dataset, req.body.recordID, req.body.data)
    const path = uri`/datasets/${req.params.user}:${req.params.dataset}/${req.body.recordID}`
    res.redirect(path)
  } catch (err) {
    const title = `Creating a record inside ${req.params.user}:${req.params.dataset}/`
    const state = {
      create: true,
      recordID: req.body.recordID,
      recordData: req.body.recordData
    }
    Vibe.docStream(title, editorView(req, state, err.message)).pipe(res.type('html'))
  }
})

router.delete('/datasets/:user\\::dataset/:recordID', auth.requireOwnerOrAdmin('user'), async (req, res) => {
  try {
    await dataset.deleteEntry(req.params.user, req.params.dataset, req.params.recordID)
    codec.respond(req, res.status(200), { deleted: true })
  } catch (err) {
    codec.respond(req, res.status(500), { deleted: false, error: err.message })
  }
})

module.exports = router
