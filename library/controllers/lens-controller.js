const express = require('express')
const router = express.Router()

const auth = require('../models/auth')
const codec = require('../models/codec')
const lens = require('../models/lens')
const uri = require('encodeuricomponent-tag')
const itToArray = require('../utility/async-iterable-to-array')

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

router.all('/lenses/create', auth.required, async (req, res) => {
  const state = {
    create: true,
    name: '',
    memo: '',
    inputs: ['/datasets/owner-user:dataset-name'],
    mapType: 'javascript',
    mapCode: mapCodeExample,
    reduceCode: reduceCodeExample
  }

  if (req.query.clone) {
    const [user, lensName] = `${req.query.clone}`.split(':')
    Object.assign(state, await lens.readConfig(user, lensName))
    state.memo = `Cloned from /lenses/${req.query.clone}/: ${state.memo}`
  }

  if (typeof req.body === 'object' && req.body !== null /* I hate you */) {
    Object.assign(state, req.body)
  }

  if (typeof state.inputs === 'string') state.inputs = state.inputs.split('\n')

  if (req.method === 'PUT') {
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
      return res.redirect(303, uri`/lenses/${req.session.auth.user}:${req.body.name}/`)
    } catch (err) {
      state.error = err.stack || err.message
    }
  }

  res.sendVibe('lens-editor', 'Create a Lens', state, state.error)
})

router.get('/lenses/:user\\::name/configuration', async (req, res) => {
  const config = await lens.readConfig(req.params.user, req.params.name)
  const state = {
    ...config,
    create: false,
    name: req.params.name
  }
  res.set('X-Version', config.version)
  if (req.accepts('html')) {
    res.sendVibe('lens-editor', 'Edit a Lens', state)
  } else {
    codec.respond(req, res, config)
  }
})

router.put('/lenses/:user\\::name/configuration', auth.ownerRequired, async (req, res) => {
  const config = await lens.readConfig(req.params.user, req.params.name)

  try {
    await lens.writeConfig(req.params.user, req.params.name, {
      ...config,
      memo: req.body.memo,
      inputs: req.body.inputs.split('\n').map(x => x.trim()).filter(x => !!x),
      mapType: req.body.mapType,
      mapCode: req.body.mapCode,
      reduceCode: req.body.reduceCode
    })
    // rebuild since settings may have changed
    await lens.build(req.session.auth.user, req.body.name)

    if (req.accepts('html')) {
      return res.redirect(303, uri`/lenses/${req.params.user}:${req.params.name}/`)
    } else {
      return res.sendStatus(204)
    }
  } catch (err) {
    const state = {
      ...req.body,
      name: req.params.name,
      create: false
    }
    console.log(err.stack)
    res.sendVibe('lens-editor', 'Edit a Lens', state, err.message)
  }
})

router.get('/lenses/:user\\::name/configuration/map.js', async (req, res) => {
  const config = await lens.readConfig(req.params.user, req.params.name)
  res.type('js').set('X-Version', config.version).send(config.mapCode)
})

router.get('/lenses/:user\\::name/configuration/reduce.js', async (req, res) => {
  const config = await lens.readConfig(req.params.user, req.params.name)
  res.type('js').set('X-Version', config.version).send(config.reduceCode)
})

router.get('/lenses/:user\\::name/logs', async (req, res) => {
  const logsIter = lens.iterateLogs(req.params.user, req.params.name)

  if (req.accepts('html')) {
    res.sendVibe('lens-log-viewer', 'Lens Logs', { mapOutputs: await itToArray(logsIter) })
  } else {
    codec.respond(req, res, logsIter)
  }
})

router.delete('/lenses/:user\\::name/', auth.ownerRequired, async (req, res) => {
  await lens.delete(req.params.user, req.params.name)
  res.redirect(303, `/lenses/${req.params.user}:`)
})

router.get('/lenses/', async (req, res) => {
  const list = {}
  for await (const user of auth.iterateUsers()) {
    const lenses = await lens.list(user)
    if (lenses && lenses.length > 0) {
      list[user] = lenses
    }
  }

  if (req.accepts('html')) {
    res.sendVibe('lens-list', 'Public Lenses', { list })
  } else {
    codec.respond(req, res, list)
  }
})

// get a list of datasets owned by a specific user
router.get('/lenses/:user\\:', async (req, res) => {
  const lenses = await lens.list(req.params.user)

  if (req.accepts('html')) {
    const title = `${req.params.user}’s Viewports`
    res.sendVibe('lens-list', title, { list: { [req.params.user]: lenses } })
  } else {
    codec.respond(req, res, lenses)
  }
})

// list contents of dataset
router.get('/lenses/:user\\::name/', async (req, res) => {
  const config = await lens.readConfig(req.params.user, req.params.name)
  res.set('X-Version', config.version)

  if (req.accepts('html')) {
    const recordIDs = await lens.listEntries(req.params.user, req.params.name)
    const title = `${req.params.user}’s “${req.params.name}” Datasets`
    res.sendVibe('lens', title, config, recordIDs)
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

// list records of lens
router.get('/lenses/:user\\::name/records/', async (req, res) => {
  const config = await lens.readConfig(req.params.user, req.params.name)
  const records = await lens.listEntryMeta(req.params.user, req.params.name)
  res.set('X-Version', config.version)
  res.set('ETag', `"${config.version}"`)
  codec.respond(req, res, Object.fromEntries(Object.entries(records).map(([id, { version, hash }]) => [id, { version, hash }])))
})

// get a record from a user's lens
router.get('/lenses/:user\\::name/records/:recordID', async (req, res) => {
  const meta = await lens.readEntryMeta(req.params.user, req.params.name, req.params.recordID)
  const record = await meta.read()
  res.set('X-Version', meta.version)

  if (req.accepts('html')) {
    const title = `${req.params.user}:${req.params.name}/${req.params.recordID}`
    const state = {
      record,
      sidebar: { recordIDs: await lens.listEntries(req.params.user, req.params.name) }
    }
    res.sendVibe('lens-record', title, state)
  } else {
    res.set('ETag', `"${meta.hash.toString('hex')}"`)
    codec.respond(req, res, record)
  }
})

// ephemeral lens runs once, exports, then is deleted
router.post('/lenses/ephemeral', async (req, res) => {
  const [user, name] = ['system', `ephemeral-${Date.now()}-${codec.objectHash(req.body).slice(0, 4).toString('hex')}`]

  try {
    await lens.create(user, name, {
      memo: `Ephemeral Test Lens: ${req.body.memo}`,
      inputs: req.body.inputs.split('\n').map(x => x.trim()).filter(x => !!x),
      mapType: req.body.mapType,
      mapCode: req.body.mapCode,
      reduceCode: req.body.reduceCode,
      garbageCollect: false
    })

    await lens.build(user, name)

    async function * iter () {
      for await (const log of lens.iterateLogs(user, name)) yield { log }
      for await (const record of lens.iterateEntries(user, name)) yield { record }
    }

    if (req.accepts('html')) {
      await res.sendVibe('lens-ephemeral-output', 'Ephemeral Test Lens Output', { iter: iter() })
    } else {
      await codec.respond(req, res, iter())
    }
  } finally {
    await lens.delete(user, name)
  }
})

module.exports = router
