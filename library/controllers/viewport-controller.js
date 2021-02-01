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

router.get('/viewports/create', auth.required, (req, res) => {
  const state = {
    create: true,
    owner: req.session.auth.user,
    name: '',
    memo: '',
    inputs: '',
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
    Vibe.docStream('Create a Viewport', viewportEditor(req, state, err.message)).pipe(res.type('html'))
  }
})

router.post('/viewports/save', auth.required, async (req, res) => {
  try {
    await viewport.writeConfig(req.session.auth.user, req.body.name, {
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
    Vibe.docStream('Create a Viewport', viewportEditor(req, state, err.message)).pipe(res.type('html'))
  }
})

router.post('/viewports/delete', auth.required, async (req, res) => {
  try {
    await viewport.delete(req.session.auth.user, req.body.name)
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
router.get('/viewports/:user\\::dataset/', async (req, res) => {
  try {
    const config = await viewport.readConfig(req.params.user, req.params.dataset)

    if (req.accepts('html')) {
      const recordIDs = await viewport.listEntries(req.params.user, req.params.dataset)
      Vibe.docStream(`${req.params.user}’s “${req.params.dataset}” Datasets`, layout(req, v => {
        v.heading(`Viewport: ${req.params.dataset}`)
        if (config.memo) v.p(config.memo)
        v.heading('Records:', { level: 3 })
        v.linkList(recordIDs, recordID => uri`/datasets/${req.params.user}:${req.params.dataset}/${recordID}`)
      })).pipe(res.type('html'))
    } else {
      const records = await viewport.listEntryHashes(req.params.user, req.params.dataset)
      codec.respond(req, res, {
        owner: req.params.user,
        name: req.params.dataset,
        config,
        records: Object.fromEntries(Object.entries(records).map(([key, value]) => [uri`/viewports/${req.params.user}:${req.params.dataset}/${key}`, value]))
      })
    }
  } catch (err) {
    codec.respond(req, res.status(404), err.message)
  }
})

// get a record from a user's dataset
router.get('/viewports/:user\\::dataset/:recordID', async (req, res) => {
  try {
    const record = await viewport.readEntry(req.params.user, req.params.dataset, req.params.recordID)

    if (req.accepts('html')) {
      Vibe.docStream(`${req.params.user}:${req.params.dataset}/${req.params.recordID}`, layout(req, v => {
        v.heading(`Record ID: ${req.params.recordID}`)
        v.sourceCode(codec.json.encode(record, 2))
      })).pipe(res.type('html'))
    } else {
      codec.respond(req, res, record)
    }
  } catch (err) {
    codec.respond(req, res.status(404), err.message)
  }
})

module.exports = router
