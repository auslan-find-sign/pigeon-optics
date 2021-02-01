const express = require('express')
const router = express.Router()

const auth = require('../models/auth')
const codec = require('../models/codec')
const viewport = require('../models/viewport')
const uri = require('encodeuricomponent-tag')

const Vibe = require('../vibe/rich-builder')
const layout = require('../views/layout')
const viewportEditor = require('../views/viewport-editor')
const soloList = require('../views/solo-list')
const viewportView = require('../views/viewport')

router.get('/viewports/create', auth.required, (req, res) => {
  const state = {
    create: true,
    owner: req.session.auth.user,
    name: '',
    memo: '',
    inputs: '/datasets/owner-user:dataset-name',
    lens: 'owner-user:lens-name'
  }
  Vibe.docStream('Create a Viewport', viewportEditor(req, state)).pipe(res.type('html'))
})

router.post('/viewports/create', auth.required, async (req, res) => {
  try {
    await viewport.create(req.session.auth.user, req.body.name, {
      memo: req.body.memo,
      lens: {
        user: req.body.lens.split(':')[0],
        name: req.body.lens.split(':')[1]
      },
      inputs: req.body.inputs.split('\n').map(x => x.trim()).filter(x => !!x)
    })
    // rebuild since settings may have changed
    await viewport.build(req.session.auth.user, req.body.name)
    res.redirect(uri`/viewports/${req.session.auth.user}:${req.body.name}/`)
  } catch (err) {
    const state = {
      create: true,
      ...req.body
    }
    console.log('Stack:', err.stack)
    Vibe.docStream('Create a Viewport', viewportEditor(req, state, err.message)).pipe(res.type('html'))
  }
})

router.get('/viewports/edit/:user\\::name/', auth.requireOwnerOrAdmin('user'), async (req, res) => {
  const config = await viewport.readConfig(req.params.user, req.params.name)
  const state = {
    create: false,
    ...config,
    lens: `${config.lens.user}:${config.lens.name}`,
    inputs: config.inputs.join('\n'),
    name: req.params.name
  }
  Vibe.docStream('Edit a Viewport', viewportEditor(req, state)).pipe(res.type('html'))
})

router.post('/viewports/edit/:user\\::name/', auth.requireOwnerOrAdmin('user'), async (req, res) => {
  try {
    await viewport.writeConfig(req.params.user, req.params.name, {
      memo: req.body.memo,
      lens: {
        user: req.body.lens.split(':')[0],
        name: req.body.lens.split(':')[1]
      },
      inputs: req.body.inputs.split('\n').map(x => x.trim()).filter(x => !!x)
    })
    // rebuild since settings may have changed
    await viewport.build(req.session.auth.user, req.body.name)

    res.redirect(uri`/viewports/${req.session.auth.user}:${req.body.name}/`)
  } catch (err) {
    const state = {
      create: false,
      name: req.params.name,
      ...req.body
    }
    console.log(err.stack)
    Vibe.docStream('Edit a Viewport', viewportEditor(req, state, err.message)).pipe(res.type('html'))
  }
})

router.post('/viewports/edit/:user\\::name/delete', auth.requireOwnerOrAdmin('user'), async (req, res) => {
  try {
    await viewport.delete(req.params.user, req.params.name)
    res.redirect(`/viewports/${req.session.auth.user}:`)
  } catch (err) {
    codec.respond(req, res.status(404), { error: err.message })
  }
})

// get a list of datasets owned by a specific user
router.get('/viewports/:user\\:', async (req, res) => {
  try {
    const viewports = await viewport.listDatasets(req.params.user)

    if (req.accepts('html')) {
      const title = `${req.params.user}’s Viewports`
      Vibe.docStream(title, soloList(req, title, viewports, x => uri`/viewports/${req.params.user}:${x}/`)).pipe(res.type('html'))
    } else {
      codec.respond(req, res, viewports)
    }
  } catch (err) {
    codec.respond(req, res.status(404), { error: err.message })
  }
})

// list contents of dataset
router.get('/viewports/:user\\::name/', async (req, res) => {
  const config = await viewport.readConfig(req.params.user, req.params.name)

  if (req.accepts('html')) {
    const recordIDs = await viewport.listEntries(req.params.user, req.params.name)
    Vibe.docStream(`${req.params.user}’s “${req.params.name}” Datasets`, viewportView(req, config, recordIDs)).pipe(res.type('html'))
  } else {
    const records = await viewport.listEntryHashes(req.params.user, req.params.name)
    codec.respond(req, res, {
      owner: req.params.user,
      name: req.params.name,
      config,
      records: Object.fromEntries(Object.entries(records).map(([key, value]) => [codec.path.encode('viewports', req.params.user, req.params.name, key), value]))
    })
  }
})

// get a record from a user's dataset
router.get('/viewports/:user\\::dataset/:recordID', async (req, res) => {
  const record = await viewport.readEntry(req.params.user, req.params.dataset, req.params.recordID)

  if (req.accepts('html')) {
    Vibe.docStream(`${req.params.user}:${req.params.dataset}/${req.params.recordID}`, layout(req, v => {
      v.heading(`Record ID: ${req.params.recordID}`)
      v.sourceCode(codec.json.encode(record, 2))
    })).pipe(res.type('html'))
  } else {
    codec.respond(req, res, record)
  }
})

module.exports = router
