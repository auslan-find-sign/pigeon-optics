const express = require('express')
const router = express.Router()

const auth = require('../models/auth')
const codec = require('../models/codec')
const dataset = require('../models/dataset')
const uri = require('encodeuricomponent-tag')

// add req.owner boolean for any routes with a :user param
router.param('user', auth.ownerParam)

// list all users and their datasets
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

// form for creating a new dataset
router.all('/datasets/create', auth.required, async (req, res) => {
  const state = { name: '', memo: '', ...req.body || {}, create: true }
  let error = false

  if (req.method === 'PUT' && req.body) {
    try {
      await dataset.create(req.session.auth.user, req.body.name, { memo: req.body.memo })
      return res.redirect(uri`/datasets/${req.session.auth.user}:${req.body.name}/`)
    } catch (err) {
      if (!req.accepts('html')) throw err
      error = err.message
    }
  }

  res.sendVibe('dataset-config-editor', 'Create a Dataset', state, error)
})

// list dataset info and records
router.get('/datasets/:user\\::name/', async (req, res) => {
  const config = await dataset.readConfig(req.params.user, req.params.name)

  if (req.accepts('html')) {
    const recordIDs = await dataset.listEntries(req.params.user, req.params.name)
    res.sendVibe('dataset-index', `${req.params.user}’s “${req.params.name}” Dataset`, { config, recordIDs })
  } else {
    const records = await dataset.listEntryMeta(req.params.user, req.params.name)
    codec.respond(req, res, {
      owner: req.params.user,
      name: req.params.name,
      config,
      records
    })
  }
})

router.all('/datasets/:user\\::name/configuration', auth.ownerRequired, async (req, res) => {
  const config = await dataset.readConfig(req.params.user, req.params.name)
  let error = false

  if (req.method === 'PUT') {
    try {
      await dataset.writeConfig(req.params.user, req.params.name, {
        ...config,
        memo: req.body.memo
      })
      if (req.accepts('html')) res.redirect(uri`/datasets/${req.params.user}:${req.params.name}/`)
      else res.sendStatus(204)
    } catch (err) {
      error = err.message
    }
  } else if (!['GET', 'HEAD'].includes(req.method)) {
    res.set('Allow', 'GET, PUT, HEAD').sendStatus(405)
  }

  const state = {
    name: req.params.name,
    memo: config.memo,
    ...req.body || {},
    create: false
  }

  if (req.accepts('html')) {
    res.sendVibe('dataset-config-editor', `Edit dataset “${req.params.name}” configuration`, state, error)
  } else {
    if (error) {
      codec.respond(req, res.status(500), error)
    } else {
      codec.respond(req, res, config)
    }
  }
})

// create a new record
router.all('/datasets/:user\\::name/create-record', auth.ownerRequired, async (req, res) => {
  const title = `Creating a record inside ${req.params.user}:${req.params.name}`
  const state = {
    create: true,
    recordID: '',
    recordData: '{\n  \n}\n',
    ...req.body || {}
  }

  let error = null
  if (req.method === 'PUT') {
    try {
      const data = codec.json.decode(req.body.recordData)
      await dataset.writeEntry(req.params.user, req.params.name, req.body.recordID, data)
      return res.redirect(uri`/datasets/${req.params.user}:${req.params.name}/records/${req.body.recordID}`)
    } catch (err) {
      error = err.message
    }
  }
  res.sendVibe('dataset-record-editor', title, state, error)
})

// create a new record
router.post('/datasets/:user\\::name/create-record', auth.ownerRequired, async (req, res) => {
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

// list records of dataset
router.get('/datasets/:user\\::name/records/', async (req, res) => {
  const records = await dataset.listEntryMeta(req.params.user, req.params.name)
  codec.respond(req, res, records)
})

router.post('/datasets/:user\\::name/records/', auth.ownerRequired, async (req, res) => {

})

// get a record from a user's dataset
router.all('/datasets/:user\\::name/records/:recordID', async (req, res) => {
  let error = null

  if (req.method === 'PUT') {
    if (!req.owner) throw new Error('You do not have write access to this dataset')
    try {
      if (req.is('urlencoded')) {
        req.body = codec.json.decode(req.body.recordData)
      }
      // write record
      const { version } = await dataset.writeEntry(req.params.user, req.params.name, req.params.recordID, req.body)

      if (!req.accepts('html')) return req.set('X-Version', version).sendStatus(204)
    } catch (err) {
      error = err.message
    }
  } else if (req.method === 'DELETE') {
    if (!req.owner) throw new Error('You do not have write access to this dataset')
    const { version } = await dataset.deleteEntry(req.params.user, req.params.name, req.params.recordID)
    if (req.accepts('html')) {
      return req.redirect(uri`/datasets/${req.params.user}:${req.params.name}/`)
    } else {
      return res.set('X-Version', version).sendStatus(204)
    }
  }

  const record = await dataset.readEntry(req.params.user, req.params.name, req.params.recordID)

  if (req.accepts('html')) {
    const title = `${req.params.user}:${req.params.name}/${req.params.recordID}`
    if (req.query.edit && req.owner) {
      res.sendVibe('dataset-record-editor', title, {
        recordID: req.params.recordID,
        recordData: codec.json.encode(record, '\t')
      }, error)
    } else {
      res.sendVibe('dataset-record', title, record)
    }
  } else {
    codec.respond(req, res, record)
  }
})

module.exports = router
