const express = require('express')
const router = module.exports = express.Router()

const auth = require('../models/auth')
const codec = require('../models/codec')
const dataset = require('../models/dataset')
const uri = require('encodeuricomponent-tag')
const createError = require('http-errors')
const assert = require('assert')
const fs = require('fs/promises')
const multipartAttachments = require('../utility/multipart-attachments')

// add req.owner boolean for any routes with a :user param
router.param('user', auth.ownerParam)

// list all users and their datasets
router.get('/datasets/', async (req, res) => {
  const list = {}
  for await (const user of auth.iterate()) {
    const datasets = await dataset.list(user)
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
  const datasets = await dataset.list(req.params.user)

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
      return res.redirect(303, uri`/datasets/${req.session.auth.user}:${req.body.name}/`)
    } catch (err) {
      if (!req.accepts('html')) throw err
      error = err.message
    }
  }

  res.sendVibe('dataset-config-editor', 'Create a Dataset', state, error)
})

// list dataset info and records
router.get('/datasets/:user\\::name/', async (req, res) => {
  const config = await dataset.readMeta(req.params.user, req.params.name)

  if (req.accepts('html')) {
    res.sendVibe('dataset-index', `${req.params.user}’s “${req.params.name}” Dataset`, { config })
  } else {
    codec.respond(req, res, {
      user: req.params.user,
      name: req.params.name,
      ...config
    })
  }
})

// delete a dataset
router.delete('/datasets/:user\\::name/', auth.ownerRequired, async (req, res) => {
  await dataset.delete(req.params.user, req.params.name)

  if (req.accepts('html')) {
    res.redirect(303, '/datasets/')
  } else {
    res.sendStatus(204)
  }
})

router.all('/datasets/:user\\::name/configuration', auth.ownerRequired, async (req, res) => {
  const config = await dataset.readMeta(req.params.user, req.params.name)
  let error = false

  if (req.method === 'PUT') {
    try {
      await dataset.updateMeta(req.params.user, req.params.name, meta => {
        meta.memo = req.body.memo
        return meta
      })
      if (req.accepts('html')) return res.redirect(303, uri`/datasets/${req.params.user}:${req.params.name}/`)
      else return res.sendStatus(204)
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

  let error
  if (req.method === 'PUT') {
    try {
      const data = codec.json.decode(req.body.recordData)
      await dataset.write(req.params.user, req.params.name, req.body.recordID, data)
      return res.redirect(303, uri`/datasets/${req.params.user}:${req.params.name}/records/${req.body.recordID}`)
    } catch (err) {
      error = err.message
    }
  }
  res.sendVibe('dataset-record-editor', title, state, error)
})

// list records of dataset
router.get('/datasets/:user\\::name/records/', async (req, res) => {
  const config = await dataset.readMeta(req.params.user, req.params.name)
  const records = await dataset.list(req.params.user, req.params.name)
  res.set('X-Version', config.version)
  res.set('ETag', `"${config.version}"`)
  codec.respond(req, res, Object.fromEntries(records.map(({ id, version, hash }) => [id, { version, hash }])))
})

router.post('/datasets/:user\\::name/records/', auth.ownerRequired, multipartAttachments, async (req, res) => {
  assert(req.body !== null, 'request body must not be null')
  assert(typeof req.body === 'object', 'request body must be an object')

  await dataset.merge(req.params.user, req.params.name, Object.entries(req.body))
  return res.sendStatus(204)
})

router.put('/datasets/:user\\::name/records/', auth.ownerRequired, multipartAttachments, async (req, res) => {
  assert(req.body !== null, 'request body must not be null')
  assert(typeof req.body === 'object', 'request body must be an object')

  await dataset.overwrite(req.params.user, req.params.name, Object.entries(req.body))
  return res.sendStatus(204)
})

// get a record from a user's dataset
router.all('/datasets/:user\\::name/records/:recordID', multipartAttachments, async (req, res, next) => {
  let error

  if (req.method === 'PUT') {
    if (!req.owner) next(createError.Unauthorized('You do not have write access to this dataset'))
    try {
      if (req.is('urlencoded')) {
        req.body = codec.json.decode(req.body.recordData)
      }

      // write record
      await dataset.write(req.params.user, req.params.name, req.params.recordID, req.body)

      if (req.accepts('html')) {
        return res.redirect(303, uri`/datasets/${req.params.user}:${req.params.name}/records/${req.params.recordID}`)
      } else {
        return req.sendStatus(204)
      }
    } catch (err) {
      error = err.message
    }
  } else if (req.method === 'DELETE') {
    if (!req.owner) return next(createError.Unauthorized('You do not have write access to this dataset'))
    await dataset.delete(req.params.user, req.params.name, req.params.recordID)
    if (req.accepts('html')) {
      return res.redirect(303, uri`/datasets/${req.params.user}:${req.params.name}/`)
    } else {
      return res.sendStatus(204)
    }
  }

  const record = await dataset.read(req.params.user, req.params.name, req.params.recordID)
  if (!record) return next(createError.NotFound('Record Not Found'))

  if (req.accepts('html')) {
    const sidebar = { recordIDs: Object.keys((await dataset.readMeta(req.params.user, req.params.name)).records) }

    const title = `${req.params.user}:${req.params.name}/${req.params.recordID}`
    if ((req.query.edit && req.owner) || req.method !== 'GET') {
      res.sendVibe('dataset-record-editor', title, {
        sidebar,
        recordID: req.params.recordID,
        recordData: codec.json.print(record, '\t')
      }, error)
    } else {
      res.sendVibe('record', title, { record, sidebar, path: { source: 'datasets', ...req.params } })
    }
  } else {
    codec.respond(req, res, record)
  }
})

// import individual json, yaml, cbor, or xml files as individual records named from their filename
router.all('/datasets/:user\\::name/import/files', auth.ownerRequired, multipartAttachments, async (req, res) => {
  const state = {}

  if (req.method === 'PUT') {
    state.wroteCount = 0
    for (const filename in req.attachmentsByFilename) {
      const fileCodec = codec.for(filename.toLowerCase())
      if (fileCodec) {
        const ext = fileCodec.extensions.find(x => filename.endsWith(`.${x}`))
        const recordID = filename.slice(0, filename.length - (ext.length + 1))
        const recordData = fileCodec.decode(await fs.readFile(req.attachmentsByFilename[filename].path))
        // todo: make some kind of input analogy to dataset.iterate that consumes async iterators or streams, to do this in one write
        await dataset.write(req.params.user, req.params.name, recordID, recordData)
        state.wroteCount += 1
      }
    }
  }

  res.sendVibe('dataset-import-files', 'Import Files', state)
})

router.get(`/datasets/:user\\::name/records/:recordID/raw.:format(${codec.exts.join('|')})?`, multipartAttachments, async (req, res) => {
  const record = await dataset.read(req.params.user, req.params.name, req.params.recordID)
  const format = req.params.format || req.query.type
  const encoder = codec.for(format)

  if (typeof record === 'string' || Buffer.isBuffer(record)) {
    res.type(format || typeof record === 'string' ? 'text/plain' : 'application/octet-stream')
    res.set('Content-Security-Policy', 'sandbox')
    res.send(record)
  } else {
    if (encoder && encoder.encode) {
      res.type(encoder.handles[0])
      res.set('Content-Security-Policy', 'sandbox')
      res.send(encoder.encode(record))
    } else {
      throw createError.InternalServerError('No way to encode content to this type')
    }
  }
})
