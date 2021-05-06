const express = require('express')
const router = express.Router()

const auth = require('../models/auth')
const codec = require('../models/codec')
const lens = require('../models/lens')
const uri = require('encodeuricomponent-tag')
const itToArray = require('../utility/async-iterable-to-array')
const parse = require('../utility/parse-request-body')

// add req.owner boolean for any routes with a :author param
router.param('author', auth.ownerParam)

const mapCodeExample = `// example, simply copies the underlying dataset, but adds a property lensed: true
const [realm, store, recordID] = recordPath.slice(1).split('/').map(x => decodeURIComponent(x))
output(recordID, {
  ...recordData,
  lensed: true
})`
const reduceCodeExample = `// example, overlays the objects overwriting properties
return { ...left, ...right }`

router.all('/lenses/create', auth.required, parse.body({ maxSize: 3145728 }), async (req, res) => {
  const state = {
    create: true,
    name: '',
    memo: '',
    inputs: ['/datasets/owner-author:dataset-name'],
    mapType: 'javascript',
    mapCode: mapCodeExample,
    reduceCode: reduceCodeExample
  }

  if (req.query.clone) {
    const [author, lensName] = `${req.query.clone}`.split(':')
    Object.assign(state, await lens.readConfig(author, lensName))
    state.memo = `Cloned from /lenses/${req.query.clone}/: ${state.memo}`
  }

  if (typeof req.body === 'object' && req.body !== null /* I hate you */) {
    Object.assign(state, req.body)
  }

  if (typeof state.inputs === 'string') state.inputs = state.inputs.split('\n')

  if (req.method === 'PUT') {
    try {
      await lens.create(req.author, req.body.name, {
        memo: req.body.memo,
        inputs: req.body.inputs.split('\n').map(x => x.trim()).filter(x => !!x),
        mapType: req.body.mapType,
        mapCode: req.body.mapCode,
        reduceCode: req.body.reduceCode
      })
      // rebuild since settings may have changed
      await lens.build(req.author, req.body.name)
      return res.redirect(303, uri`/lenses/${req.author}:${req.body.name}/`)
    } catch (err) {
      state.error = err.stack || err.message
    }
  }

  res.sendVibe('lens-editor', 'Create a Lens', state, state.error)
})

router.get('/lenses/:author\\::name/configuration', async (req, res) => {
  const config = await lens.readMeta(req.params.author, req.params.name)
  const state = {
    ...config,
    create: false,
    owner: req.params.author,
    name: req.params.name
  }
  res.set('X-Version', config.version)
  if (req.accepts('html')) {
    res.sendVibe('lens-editor', 'Edit a Lens', state)
  } else {
    codec.respond(req, res, config)
  }
})

router.put('/lenses/:author\\::name/configuration', auth.ownerRequired, parse.body({ maxSize: 3145728 }), async (req, res) => {
  try {
    await lens.updateMeta(req.params.author, req.params.name, meta => {
      meta.memo = req.body.memo
      meta.inputs = req.body.inputs.split(/\r?\n/m).map(x => x.trim()).filter(x => !!x)
      meta.mapType = req.body.mapType
      meta.mapCode = req.body.mapCode
      meta.reduceCode = req.body.reduceCode
      return meta
    })
    // rebuild since settings may have changed
    await lens.build(req.params.author, req.params.name)

    if (req.accepts('html')) {
      return res.redirect(303, uri`/lenses/${req.params.author}:${req.params.name}/`)
    } else {
      return res.sendStatus(204)
    }
  } catch (err) {
    const state = { ...req.body, create: false }
    console.log(err.stack)
    res.sendVibe('lens-editor', 'Edit a Lens', state, err.message)
  }
})

router.get('/lenses/:author\\::name/configuration/map', async (req, res) => {
  const meta = await lens.readMeta(req.params.author, req.params.name)
  res.type(meta.mapType).set('X-Version', meta.version).send(meta.mapCode)
})

router.get('/lenses/:author\\::name/configuration/reduce', async (req, res) => {
  const meta = await lens.readMeta(req.params.author, req.params.name)
  res.type(meta.mapType).set('X-Version', meta.version).send(meta.reduceCode)
})

router.get('/lenses/:author\\::name/logs', async (req, res) => {
  const logsIter = lens.iterateLogs(req.params.author, req.params.name)

  if (req.accepts('html')) {
    res.sendVibe('lens-log-viewer', 'Lens Logs', { mapOutputs: await itToArray(logsIter) })
  } else {
    codec.respond(req, res, logsIter)
  }
})

router.delete('/lenses/:author\\::name/', auth.ownerRequired, async (req, res) => {
  await lens.delete(req.params.author, req.params.name)
  res.redirect(303, `/lenses/${req.params.author}:`)
})

router.get('/lenses/', async (req, res) => {
  const list = {}
  for await (const author of auth.iterate()) {
    const lenses = await lens.list(author)
    if (lenses && lenses.length > 0) {
      list[author] = lenses
    }
  }

  if (req.accepts('html')) {
    res.sendVibe('lens-list', 'Public Lenses', { list })
  } else {
    codec.respond(req, res, list)
  }
})

// get a list of datasets owned by a specific author
router.get('/lenses/:author\\:', async (req, res) => {
  const lenses = await lens.list(req.params.author)

  if (req.accepts('html')) {
    const title = `${req.params.author}’s Viewports`
    res.sendVibe('lens-list', title, { list: { [req.params.author]: lenses } })
  } else {
    codec.respond(req, res, lenses)
  }
})

// list contents of dataset
router.get('/lenses/:author\\::name/', async (req, res) => {
  const config = await lens.readMeta(req.params.author, req.params.name)
  res.set('X-Version', config.version)

  if (req.accepts('html')) {
    const title = `${req.params.author}’s “${req.params.name}” Datasets`
    res.sendVibe('lens', title, config)
  } else {
    const records = await lens.listEntryHashes(req.params.author, req.params.name)
    codec.respond(req, res, {
      owner: req.params.author,
      name: req.params.name,
      config,
      records: Object.fromEntries(Object.entries(records).map(([key, value]) => [codec.path.encode('lenses', req.params.author, req.params.name, key), value]))
    })
  }
})

// list records of lens
router.get('/lenses/:author\\::name/records/', async (req, res) => {
  const config = await lens.readMeta(req.params.author, req.params.name)
  res.set('X-Version', config.version)
  res.set('ETag', `"${config.version}"`)
  codec.respond(req, res, config.records)
})

// get a record from a author's lens
router.get('/lenses/:author\\::name/records/:recordID', async (req, res) => {
  const record = await lens.read(req.params.author, req.params.name, req.params.recordID)

  if (req.accepts('html')) {
    const meta = await lens.readMeta(req.params.author, req.params.name)

    const title = `${req.params.author}:${req.params.name}/${req.params.recordID}`
    const sidebar = { recordIDs: Object.keys(meta.records) }
    res.sendVibe('record', title, { record, sidebar, path: { source: 'lenses', ...req.params } })
  } else {
    codec.respond(req, res, record)
  }
})

// ephemeral lens runs once, exports, then is deleted
router.post('/lenses/ephemeral', parse.body({ maxSize: 3145728 }), async (req, res) => {
  const [author, name] = ['system', `ephemeral-${Date.now()}-${codec.objectHash(req.body).slice(0, 4).toString('hex')}`]

  try {
    await lens.create(author, name, {
      memo: `Ephemeral Test Lens: ${req.body.memo}`,
      inputs: req.body.inputs.split('\n').map(x => x.trim()).filter(x => !!x),
      mapType: req.body.mapType,
      mapCode: req.body.mapCode,
      reduceCode: req.body.reduceCode,
      garbageCollect: false
    })

    await lens.build(author, name)

    async function * iter () {
      for await (const log of lens.iterateLogs(author, name)) yield { log }
      for await (const record of lens.iterateEntries(author, name)) yield { record }
    }

    if (req.accepts('html')) {
      await res.sendVibe('lens-ephemeral-output', 'Ephemeral Test Lens Output', { iter: iter() })
    } else {
      await codec.respond(req, res, iter())
    }
  } finally {
    await lens.delete(author, name)
  }
})

module.exports = router
