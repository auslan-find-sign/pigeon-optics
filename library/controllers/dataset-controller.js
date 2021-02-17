const express = require('express')
const router = express.Router()

const auth = require('../models/auth')
const codec = require('../models/codec')
const dataset = require('../models/dataset')
const uri = require('encodeuricomponent-tag')

// add req.owner boolean for any routes with a :user param
router.param('user', auth.ownerParam)

router.get('/datasets/create', auth.required, (req, res) => {
  const state = {
    name: '',
    memo: '',
    create: true
  }
  res.sendVibe('dataset-config-editor', 'Create a Dataset', state)
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
    res.sendVibe('dataset-config-editor', 'Create a Dataset', state, err.message)
  }
})

router.get('/datasets/edit/:user\\::name', auth.requireOwnerOrAdmin('user'), async (req, res) => {
  const config = await dataset.readConfig(req.params.user, req.params.name)
  const state = {
    name: req.params.name,
    memo: config.memo,
    create: false
  }
  res.sendVibe('dataset-config-editor', `Edit Dataset “${req.params.name}”`, state)
})

router.post('/datasets/edit/:user\\::name', auth.requireOwnerOrAdmin('user'), async (req, res) => {
  try {
    await dataset.writeConfig(req.params.user, req.params.name, { memo: req.body.memo })
    res.redirect(uri`/datasets/${req.params.user}:${req.params.name}/`)
  } catch (err) {
    const state = { create: true, memo: req.body.memo }
    res.sendVibe('dataset-config-editor', `Edit Dataset “${req.params.name}”`, state, err.message)
  }
})

router.get('/datasets/', async (req, res) => {
  const list = {}
  for await (const user of auth.iterateUsers()) {
    const datasets = await dataset.listDatasets(user)
    if (datasets && datasets.length > 0) {
      list[user] = datasets
    }
  }

  if (req.accepts('html')) {
    res.sendVibe('dataset-list', 'Public Datasets', { list })
  } else {
    codec.respond(req, res, list)
  }
})

// get a list of datasets owned by a specific user
router.get('/datasets/:user\\:', async (req, res) => {
  const datasets = await dataset.listDatasets(req.params.user)

  if (req.accepts('html')) {
    res.sendVibe('dataset-list', `${req.params.user}’s Datasets`, { list: { [req.params.user]: datasets } })
  } else {
    codec.respond(req, res, datasets)
  }
})

// list contents of dataset
router.get('/datasets/:user\\::name/', async (req, res) => {
  const config = await dataset.readConfig(req.params.user, req.params.name)

  if (req.accepts('html')) {
    const recordIDs = await dataset.listEntries(req.params.user, req.params.name)
    res.sendVibe('dataset-index', `${req.params.user}’s “${req.params.name}” Dataset`, { config, recordIDs })
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
    res.sendVibe('dataset-record', `${req.params.user}:${req.params.name}/${req.params.recordID}`, record)
  } else {
    codec.respond(req, res, record)
  }
})

// UI to edit a record from a user's dataset
router.get('/datasets/:user\\::name/:recordID/edit', auth.requireOwnerOrAdmin('user'), async (req, res) => {
  const record = await dataset.readEntry(req.params.user, req.params.name, req.params.recordID)

  const title = `Editing ${req.params.user}:${req.params.name}/${req.params.recordID}`
  const state = {
    create: false,
    recordID: req.params.recordID,
    recordData: codec.json.encode(record, 2)
  }

  res.sendVibe('dataset-record-editor', title, state)
})

router.post('/datasets/:user\\::name/:recordID', auth.requireOwnerOrAdmin('user'), async (req, res) => {
  try {
    const data = codec.json.decode(req.body.recordData)
    await dataset.writeEntry(req.params.user, req.params.name, req.params.recordID, data)
    res.redirect(uri`/datasets/${req.params.user}:${req.params.name}/${req.params.recordID}`)
  } catch (error) {
    const title = `Editing ${req.params.user}:${req.params.name}/${req.params.recordID}`
    const state = {
      create: false,
      recordID: req.params.recordID,
      recordData: req.body.recordData
    }
    res.sendVibe('dataset-record-editor', title, state, error.message)
  }
})

router.post('/datasets/:user\\::name/:recordID/delete', auth.requireOwnerOrAdmin('user'), async (req, res) => {
  try {
    await dataset.deleteEntry(req.params.user, req.params.name, req.params.recordID)
    res.redirect(uri`/datasets/${req.params.user}:${req.params.name}/`)
  } catch (error) {
    const title = `Editing ${req.params.user}:${req.params.name}/${req.params.recordID}`
    const state = {
      create: true,
      recordID: req.params.recordID,
      recordData: req.body.recordData
    }
    res.sendVibe('dataset-record-editor', title, state, error.message)
  }
})

router.get('/datasets/create-record/:user\\::name/', auth.requireOwnerOrAdmin('user'), (req, res) => {
  const title = `Creating a record inside ${req.params.user}:${req.params.name}/`
  const state = {
    create: true,
    recordID: '',
    recordData: '{}'
  }
  res.sendVibe('dataset-record-editor', title, state)
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

    res.sendVibe('dataset-record-editor', title, state, err.message)
  }
})

router.delete('/datasets/:user\\::name/:recordID', auth.requireOwnerOrAdmin('user'), async (req, res) => {
  await dataset.deleteEntry(req.params.user, req.params.name, req.params.recordID)
  codec.respond(req, res, { deleted: true })
})

module.exports = router
