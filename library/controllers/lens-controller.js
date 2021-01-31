const express = require('express')
const router = express.Router()

const Vibe = require('../vibe/rich-builder')
const layout = require('../views/layout')
const uri = require('encodeuricomponent-tag')
const lensEditor = require('../views/lens-code-editor')
const lensViewer = require('../views/lens-viewer')

const auth = require('../models/auth')
const codec = require('../models/codec')
const dataset = require('../models/dataset')
const jsLens = require('../models/javascript-lens')

const mapCodeExample = `// example, simply copies the underlying dataset, but adds a property lensed: true
const [realm, store, recordID] = recordPath.slice(1).split('/').map(x => decodeURIComponent(x))
output(recordID, {
  ...recordData,
  lensed: true
})`
const mergeCodeExample = `// example, overlays the objects overwriting properties
return { ...left, ...right }`

router.get('/lenses/create', auth.required, (req, res) => {
  const state = {
    name: '',
    mapCode: mapCodeExample,
    mergeCode: mergeCodeExample,
    create: true
  }
  Vibe.docStream('Create a Lens', lensEditor(req, state)).pipe(res.type('html'))
})

router.post('/lenses/save', auth.required, async (req, res) => {
  try {
    await jsLens.write(req.session.auth.user, req.body.name, req.body.mapCode, req.body.mergeCode)
  } catch (err) {
    return codec.respond(req, res, { error: err.message })
  }
  res.redirect(uri`/lenses/${req.session.auth.user}:${req.body.name}/`)
})

// get a list of lenses owned by a specific user
router.get('/lenses/:user\\:', async (req, res) => {
  const lenses = await jsLens.list(req.params.user)

  if (req.accepts('html')) {
    Vibe.docStream(`${req.params.user}’s Javascript Lenses`, layout(req, v => {
      v.heading(`${req.params.user}’s Javascript Lenses:`)
      for (const lens of lenses) {
        v.div(v => v.a(dataset, { href: uri`/lenses/${req.params.user}:${lens}/` }))
      }
    })).pipe(res.type('html'))
  } else {
    codec.respond(req, res, lenses)
  }
})

router.get('/lenses/:user\\::name/', async (req, res) => {
  try {
    const lens = await jsLens.read(req.params.user, req.params.name)
    Vibe.docStream(
      `${req.params.user}’s lens “${req.params.name}”`,
      lensViewer(req, lens)
    ).pipe(res.type('html'))
  } catch (err) {
    return codec.respond(req, res, { error: err.message })
  }
})

router.get('/lenses/:user\\::name/edit', auth.requireOwnerOrAdmin('user'), async (req, res) => {
  try {
    const lens = await jsLens.read(req.params.user, req.params.name)
    lens.name = req.params.name
    Vibe.docStream('Editing Lens', lensEditor(req, lens)).pipe(res.type('html'))
  } catch (err) {
    return codec.respond(req, res, { error: err.message })
  }
})

router.post('/lenses/:user\\::name/save', auth.requireOwnerOrAdmin('user'), async (req, res) => {
  try {
    await jsLens.write(req.params.user, req.params.name, req.body.mapCode, req.body.mergeCode)
    res.redirect(uri`/lenses/${req.params.user}:${req.params.name}/`)
  } catch (err) {
    return codec.respond(req, res, { error: err.message })
  }
})

router.post('/lenses/:user\\::name/delete', auth.requireOwnerOrAdmin('user'), async (req, res) => {
  try {
    await jsLens.delete(req.params.user, req.params.name)
    res.redirect(uri`/lenses/${req.params.user}:`)
  } catch (err) {
    return codec.respond(req, res, { error: err.message })
  }
})

module.exports = router
