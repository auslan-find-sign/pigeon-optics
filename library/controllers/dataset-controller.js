const express = require('express')
const router = express.Router()

const auth = require('../models/auth')
const codec = require('../models/codec')
const dataset = require('../models/dataset')
const ui = require('../ui')
const html = require('nanohtml')
const serverTools = require('../server-tools')
const standardPage = require('../views/standard-page')
const uri = require('encodeuricomponent-tag')

router.get('/datasets/create', auth.required, (req, res) => {
  const memo = [ui.paragraph({ contents: 'New dataset will be created under your account and owned by you' })]
  if (req.query.err) memo.push(ui.paragraph({ contents: [ui.glitch('Error: '), req.query.err] }))

  serverTools.sendWebpage(req, res, {
    title: 'Create a Dataset',
    contents: standardPage(req, ui.simpleForm({
      title: 'Create a new dataset',
      memo,
      url: '/datasets/',
      fields: {
        name: { label: 'Name', value: req.query.name },
        memo: { label: 'Short Description', value: req.query.memo }
      },
      buttonLabel: 'Create'
    }))
  })
})

router.post('/datasets/', auth.required, async (req, res) => {
  try {
    await dataset.create(req.session.auth.user, req.body.name, {
      memo: req.body.memo
    })
    const path = uri`/datasets/${req.session.auth.user}:${req.body.name}/`

    if (req.accepts('html')) {
      res.redirect(path)
    } else {
      codec.respond(req, res.status(201).set('Location', path), {
        success: true,
        user: req.session.auth.user,
        dataset: req.body.name,
        path: path
      })
    }
  } catch (err) {
    if (req.accepts('text/html')) {
      res.redirect(uri`/datasets/create?err=${err.message}&name=${req.body.name}&memo=${req.body.memo}`)
    } else {
      codec.respond(req, res.status(400), { err: err.message })
    }
  }
})

// get a list of datasets owned by a specific user
router.get('/datasets/:user\\:', async (req, res) => {
  const datasets = await dataset.listDatasets(req.params.user)

  if (req.accepts('html')) {
    serverTools.sendWebpage(req, res, {
      title: `User’s Datasets: ${req.params.user}`,
      contents: standardPage(req, [
        ui.heading({ contents: 'Datasets:' }),
        ...datasets.map(x =>
          html`<div><a href="${uri`/datasets/${req.params.user}:${x}/`}">${x}</a></div>`
        )
      ])
    })
  } else {
    codec.respond(req, res, datasets)
  }
})

// list contents of dataset
router.get('/datasets/:user\\::dataset/', async (req, res) => {
  const config = await dataset.readConfig(req.params.user, req.params.dataset)

  if (req.accepts('html')) {
    const recordIDs = await dataset.listEntries(req.params.user, req.params.dataset)
    serverTools.sendWebpage(req, res, {
      title: `User’s Datasets: ${req.params.user}`,
      contents: standardPage(req, [
        ui.heading({ contents: `Dataset: ${req.params.dataset}` }),
        ui.paragraph({ contents: config.memo }),
        ui.heading({ contents: 'Records:', level: 3 }),
        ...recordIDs.map(x =>
          html`<div><a href="${uri`/datasets/${req.params.user}:${req.params.dataset}/${x}`}">${x}</a></div>`
        )
      ])
    })
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
  const record = await dataset.readEntry(req.params.user, req.params.dataset, req.params.recordID)

  if (req.accepts('html')) {
    serverTools.sendWebpage(req, res, {
      title: 'Form Information Recieved',
      contents: standardPage(req, ui.noticePanel({
        title: `Record ID: ${req.params.recordID}`,
        contents: ui.sourceCode({ contents: `${codec.json.encode(record, 2)}` })
      }))
    })
  } else {
    codec.respond(req, res, record)
  }
})

router.get('/datasets/create-record/:user\\::dataset', auth.requireOwnerOrAdmin('user'), (req, res) => {
  const memo = [ui.paragraph({ contents: 'New record will be added to dataset' })]
  if (req.query.err) memo.push(ui.paragraph({ contents: [ui.glitch('Error: '), req.query.err] }))

  serverTools.sendWebpage(req, res, {
    title: 'Add record',
    contents: standardPage(req, ui.simpleForm({
      title: `Add record to dataset ${req.params.user}:${req.params.dataset}`,
      memo,
      url: uri`/datasets/${req.params.user}:${req.params.dataset}/`,
      fields: {
        recordID: { label: 'Label', value: req.query.recordID },
        data: { label: 'JSON Data', value: req.query.data },
        parseData: { type: 'hidden', value: 'json' }
      },
      buttonLabel: 'Create'
    }))
  })
})

// create a new record
router.post('/datasets/:user\\::dataset/', auth.requireOwnerOrAdmin('user'), async (req, res) => {
  if (req.body.parseData === 'json') {
    try {
      req.body.data = codec.json.decode(req.body.data)
    } catch (err) {
      return res.redirect(uri`/datasets/create-record/${req.params.user}:${req.params.dataset}?recordID=${req.body.recordID}&data=${req.body.data}&err=${err.message}`)
    }
  }

  await dataset.writeEntry(req.params.user, req.params.dataset, req.body.recordID, req.body.data)
  const path = uri`/datasets/${req.params.user}:${req.params.dataset}/${req.body.recordID}`

  if (req.accepts('html')) {
    res.redirect(path)
  } else {
    codec.respond(req, res.status(201).set('Location', path), { created: true, path })
  }
})

router.delete('/datasets/:user\\::dataset/:recordID', auth.requireOwnerOrAdmin('user'), async (req, res) => {
  await dataset.deleteEntry(req.params.user, req.params.dataset, req.params.recordID)

  if (req.accepts('html')) {
    res.redirect(uri`/datasets/${req.params.user}:${req.params.dataset}/`)
  } else {
    codec.respond(req, res.status(200), { deleted: true })
  }
})


    }

router.delete('/datasets/:user\\::dataset/:recordID', auth.requireOwnerOrAdmin('user'), async (req, res) => {
  try {
    await dataset.deleteEntry(req.params.user, req.params.dataset, req.params.recordID)
    codec.respond(req, res.status(200), { deleted: true })
  } catch (err) {
    codec.respond(req, res.status(500), { deleted: false, error: err.message })
  }
})

module.exports = router
