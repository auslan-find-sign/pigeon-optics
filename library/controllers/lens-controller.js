const express = require('express')
const router = express.Router()

const auth = require('../models/auth')
const codec = require('../models/codec')
const lens = require('../models/lens')
const uri = require('encodeuricomponent-tag')

const Vibe = require('../vibe/rich-builder')
const layout = require('../views/layout')
const lensEditorView = require('../views/lens-editor')
const soloList = require('../views/solo-list')
const lensView = require('../views/lens')

// add req.owner boolean for any routes with a :user param
router.param('user', auth.ownerParam)

const mapCodeExample = `// example, simply copies the underlying dataset, but adds a property lensed: true
const [realm, store, recordID] = recordPath.slice(1).split('/').map(x => decodeURIComponent(x))
output(recordID, {
  ...recordData,
  lensed: true
})`
const reduceCodeExample = `// example, overlays the objects overwriting properties
return { ...left, ...right }`

router.get('/lenses/create', auth.required, async (req, res) => {
  const state = {
    create: true,
    name: '',
    memo: '',
    inputs: '/datasets/owner-user:dataset-name',
    mapType: 'javascript',
    mapCode: mapCodeExample,
    reduceCode: reduceCodeExample
  }
  if (req.query.clone) {
    const [user, lensName] = `${req.query.clone}`.split(':')
    const cloneConfig = await lens.readConfig(user, lensName)
    Object.assign(state, cloneConfig)
    state.inputs = cloneConfig.inputs.join('\n')
    state.memo = `Cloned from /lenses/${req.query.clone}/: ${cloneConfig.memo}`
  }
  Vibe.docStream('Create a Lens', lensEditorView(req, state)).pipe(res.type('html'))
})

router.post('/lenses/create', auth.required, async (req, res) => {
  try {
    await lens.create(req.session.auth.user, req.body.name, {
      memo: req.body.memo,
      inputs: req.body.inputs.split('\n').map(x => x.trim()).filter(x => !!x),
      mapType: req.body.mapType,
      mapCode: req.body.mapCode,
      reduceCode: req.body.reduceCode
    })
    // rebuild since settings may have changed
    await lens.build(req.session.auth.user, req.body.name)
    res.redirect(uri`/lenses/${req.session.auth.user}:${req.body.name}/`)
  } catch (err) {
    const state = {
      create: true,
      ...req.body
    }
    console.log('Stack:', err.stack)
    Vibe.docStream('Create a Lens', lensEditorView(req, state, err.message)).pipe(res.type('html'))
  }
})

router.get('/lenses/edit/:user\\::name/', auth.requireOwnerOrAdmin('user'), async (req, res) => {
  const config = await lens.readConfig(req.params.user, req.params.name)
  const state = {
    create: false,
    ...config,
    inputs: config.inputs.join('\n'),
    name: req.params.name
  }
  Vibe.docStream('Edit a Lens', lensEditorView(req, state)).pipe(res.type('html'))
})

router.post('/lenses/edit/:user\\::name/', auth.requireOwnerOrAdmin('user'), async (req, res) => {
  try {
    await lens.writeConfig(req.params.user, req.params.name, {
      memo: req.body.memo,
      inputs: req.body.inputs.split('\n').map(x => x.trim()).filter(x => !!x),
      mapType: req.body.mapType,
      mapCode: req.body.mapCode,
      reduceCode: req.body.reduceCode
    })
    // rebuild since settings may have changed
    await lens.build(req.session.auth.user, req.body.name)

    res.redirect(uri`/lenses/${req.params.user}:${req.params.name}/`)
  } catch (err) {
    const state = {
      create: false,
      name: req.params.name,
      ...req.body
    }
    console.log(err.stack)
    Vibe.docStream('Edit a Lens', lensEditorView(req, state, err.message)).pipe(res.type('html'))
  }
})

router.post('/lenses/edit/:user\\::name/delete', auth.requireOwnerOrAdmin('user'), async (req, res) => {
  await lens.delete(req.params.user, req.params.name)
  res.redirect(`/lenses/${req.params.user}:`)
})

// get a list of datasets owned by a specific user
router.get('/lenses/:user\\:', async (req, res) => {
  try {
    const lenses = await lens.listDatasets(req.params.user)

    if (req.accepts('html')) {
      const title = `${req.params.user}’s Viewports`
      Vibe.docStream(title, soloList(req, title, lenses, x => uri`/lenses/${req.params.user}:${x}/`)).pipe(res.type('html'))
    } else {
      codec.respond(req, res, lenses)
    }
  } catch (err) {
    codec.respond(req, res.status(404), { error: err.message })
  }
})

// list contents of dataset
router.get('/lenses/:user\\::name/', async (req, res) => {
  const config = await lens.readConfig(req.params.user, req.params.name)

  if (req.accepts('html')) {
    const recordIDs = await lens.listEntries(req.params.user, req.params.name)
    Vibe.docStream(`${req.params.user}’s “${req.params.name}” Datasets`, lensView(req, config, recordIDs)).pipe(res.type('html'))
  } else {
    const records = await lens.listEntryHashes(req.params.user, req.params.name)
    codec.respond(req, res, {
      owner: req.params.user,
      name: req.params.name,
      config,
      records: Object.fromEntries(Object.entries(records).map(([key, value]) => [codec.path.encode('lenses', req.params.user, req.params.name, key), value]))
    })
  }
})

// get a record from a user's dataset
router.get('/lenses/:user\\::name/:recordID', async (req, res) => {
  const record = await lens.readEntry(req.params.user, req.params.name, req.params.recordID)

  if (req.accepts('html')) {
    Vibe.docStream(`${req.params.user}:${req.params.name}/${req.params.recordID}`, layout(req, v => {
      v.heading(`Record ID: ${req.params.recordID}`)
      v.sourceCode(codec.json.encode(record, 2))
    })).pipe(res.type('html'))
  } else {
    codec.respond(req, res, record)
  }
})

module.exports = router
