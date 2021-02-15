const express = require('express')
const router = express.Router()

const auth = require('../models/auth')
const codec = require('../models/codec')
const dataset = require('../models/dataset')
const uri = require('encodeuricomponent-tag')

const Vibe = require('../vibe/rich-builder')
const recordView = require('../views/dataset-record')
const datasetIndex = require('../views/dataset-index')
const recordEditorView = require('../views/dataset-record-editor')
const configEditView = require('../views/dataset-config-editor')
const soloList = require('../views/solo-list')

// add req.owner boolean for any routes with a :user param
router.param('user', auth.ownerParam)

router.get('/datasets/create', auth.required, (req, res) => {
  const state = {
    name: '',
    memo: '',
    create: true
  }
  Vibe.docStream('Create a Dataset', configEditView(req, state)).pipe(res)
})

router.post('/datasets/create', auth.required, async (req, res) => {
  try {
    await dataset.create(req.session.auth.user, req.body.name, {
      memo: req.body.memo
    })
    res.redirect(uri`/datasets/${req.session.auth.user}:${req.body.name}/`)
  } catch (err) {
    const state = {
      create: true
    }
    Vibe.docStream('Create a Dataset', configEditView(req, state, err.message)).pipe(res)
  }
})

router.get('/datasets/edit/:user\\::name', auth.requireOwnerOrAdmin('user'), async (req, res) => {
  const config = await dataset.readConfig(req.params.user, req.params.name)
  const state = {
    name: req.params.name,
    memo: config.memo,
    create: false
  }
  Vibe.docStream(`Edit Dataset “${req.params.name}”`, configEditView(req, state)).pipe(res)
})

router.post('/datasets/edit/:user\\::name', auth.requireOwnerOrAdmin('user'), async (req, res) => {
  try {
    await dataset.writeConfig(req.params.user, req.params.name, { memo: req.body.memo })
    res.redirect(uri`/datasets/${req.params.user}:${req.params.name}/`)
  } catch (err) {
    const state = { create: true, memo: req.body.memo }
    Vibe.docStream('Create a Dataset', configEditView(req, state, err.message)).pipe(res)
  }
})

// get a list of datasets owned by a specific user
router.get('/datasets/:user\\:', async (req, res) => {
  const datasets = await dataset.listDatasets(req.params.user)

  if (req.accepts('html')) {
    const title = `${req.params.user}’s Datasets`
    Vibe.docStream(title, soloList(req, title, datasets, (x) => uri`/datasets/${req.params.user}:${x}/`)).pipe(res)
  } else {
    codec.respond(req, res, datasets)
  }
})

// list contents of dataset
router.get('/datasets/:user\\::name/', async (req, res) => {
  const config = await dataset.readConfig(req.params.user, req.params.name)

  if (req.accepts('html')) {
    const recordIDs = await dataset.listEntries(req.params.user, req.params.name)
    Vibe.docStream(`${req.params.user}’s “${req.params.name}” Datasets`, datasetIndex(req, { config, recordIDs })).pipe(res)
  } else {
    const records = await dataset.listEntryHashes(req.params.user, req.params.name)
    codec.respond(req, res, {
      owner: req.params.user,
      name: req.params.name,
      config,
      records: Object.fromEntries(Object.entries(records).map(([key, value]) => [uri`/datasets/${req.params.user}:${req.params.name}/${key}`, value]))
    })
  }
})

// get a record from a user's dataset
router.get('/datasets/:user\\::name/:recordID', async (req, res) => {
  const record = await dataset.readEntry(req.params.user, req.params.name, req.params.recordID)

  if (req.accepts('html')) {
    Vibe.docStream(`${req.params.user}:${req.params.name}/${req.params.recordID}`, recordView(req, record)).pipe(res)
  } else {
    codec.respond(req, res, record)
  }
})

// UI to edit a record from a user's dataset
router.get('/datasets/:user\\::dataset/:recordID/edit', auth.requireOwnerOrAdmin('user'), async (req, res) => {
  const record = await dataset.readEntry(req.params.user, req.params.dataset, req.params.recordID)

  const title = `Editing ${req.params.user}:${req.params.dataset}/${req.params.recordID}`
  const state = {
    create: false,
    recordID: req.params.recordID,
    recordData: codec.json.encode(record, 2)
  }
  Vibe.docStream(title, recordEditorView(req, state)).pipe(res)
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
    Vibe.docStream(title, recordEditorView(req, state, error.message)).pipe(res)
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
    Vibe.docStream(title, recordEditorView(req, state, error.message)).pipe(res)
  }
})

router.get('/datasets/create-record/:user\\::name/', auth.requireOwnerOrAdmin('user'), (req, res) => {
  const title = `Creating a record inside ${req.params.user}:${req.params.name}/`
  const state = {
    create: true,
    recordID: '',
    recordData: '{}'
  }
  Vibe.docStream(title, recordEditorView(req, state)).pipe(res)
})

// create a new record
router.post('/datasets/create-record/:user\\::name/', auth.requireOwnerOrAdmin('user'), async (req, res) => {
  try {
    req.body.data = codec.json.decode(req.body.recordData)
    await dataset.writeEntry(req.params.user, req.params.name, req.body.recordID, req.body.data)
    const path = uri`/datasets/${req.params.user}:${req.params.name}/${req.body.recordID}`
    res.redirect(path)
  } catch (err) {
    const title = `Creating a record inside ${req.params.user}:${req.params.name}/`
    const state = {
      create: true,
      recordID: req.body.recordID,
      recordData: req.body.recordData
    }
    console.log(err.stack)
    Vibe.docStream(title, recordEditorView(req, state, err.message)).pipe(res)
  }
})

router.delete('/datasets/:user\\::name/:recordID', auth.requireOwnerOrAdmin('user'), async (req, res) => {
  await dataset.deleteEntry(req.params.user, req.params.name, req.params.recordID)
  codec.respond(req, res, { deleted: true })
})

module.exports = router
