const express = require('express')
const router = express.Router()

const auth = require('../models/auth')
const codec = require('../models/codec')
const dataset = require('../models/dataset')
const uri = require('encodeuricomponent-tag')
const createError = require('http-errors')
const assert = require('assert')
const multipartAttachments = require('../utility/multipart-attachments')
const { listReferences } = require('../models/attachment')
const attachmentStore = require('../models/attachment-storage')
const fs = require('fs-extra')

// add req.owner boolean for any routes with a :user param
router.param('user', auth.ownerParam)

// list all users and their datasets
router.get('/datasets/', async (req, res) => {
  const list = {}
  for await (const user of auth.iterateUsers()) {
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
  const config = await dataset.readConfig(req.params.user, req.params.name)
  let error = false

  if (req.method === 'PUT') {
    try {
      await dataset.writeConfig(req.params.user, req.params.name, {
        ...config,
        memo: req.body.memo
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
      await dataset.writeEntry(req.params.user, req.params.name, req.body.recordID, data)
      return res.redirect(303, uri`/datasets/${req.params.user}:${req.params.name}/records/${req.body.recordID}`)
    } catch (err) {
      error = err.message
    }
  }
  res.sendVibe('dataset-record-editor', title, state, error)
})

// list records of dataset
router.get('/datasets/:user\\::name/records/', async (req, res) => {
  const config = await dataset.readConfig(req.params.user, req.params.name)
  const records = await dataset.listEntryMeta(req.params.user, req.params.name)
  res.set('X-Version', config.version)
  res.set('ETag', `"${config.version}"`)
  codec.respond(req, res, Object.fromEntries(Object.entries(records).map(([id, { version, hash }]) => [id, { version, hash }])))
})

router.post('/datasets/:user\\::name/records/', auth.ownerRequired, multipartAttachments, async (req, res) => {
  assert(req.body !== null, 'request body must not be null')
  assert(typeof req.body === 'object', 'request body must be an object')

  // import attachments?
  if (req.attachments) {
    for (const recordID in req.body) {
      const references = new Set(listReferences(req.body[recordID]).map(x => x.hash.toString('hex')))
      for (const hexhash of references.values()) {
        if (req.attachments[hexhash]) {
          const dataPath = codec.path.encode('datasets', req.params.user, req.params.name, recordID)
          await attachmentStore.writeHashedStream(dataPath, Buffer.from(hexhash, 'hex'), fs.createReadStream(req.attachments[hexhash]))
        }
      }
    }
  }

  // validate all references are available
  const missing = await attachmentStore.listMissing([...new Set(listReferences(req.body).map(x => x.hash.toString('hex')))])
  if (missing.length > 0) {
    return res.set('X-Pigeon-Optics-Resend-With-Attachments', missing.join(',')).sendStatus(400)
  }

  await dataset.merge(req.params.user, req.params.name, Object.entries(req.body))
  return res.sendStatus(204)
})

router.put('/datasets/:user\\::name/records/', auth.ownerRequired, multipartAttachments, async (req, res) => {
  assert(req.body !== null, 'request body must not be null')
  assert(typeof req.body === 'object', 'request body must be an object')

  // import attachments?
  if (req.attachments) {
    for (const recordID in req.body) {
      const references = [...new Set(listReferences(req.body[recordID]).map(x => x.hash.toString('hex')))]
      for (const hexhash of references) {
        if (req.attachments[hexhash]) {
          const dataPath = codec.path.encode('datasets', req.params.user, req.params.name, recordID)
          await attachmentStore.writeHashedStream(dataPath, Buffer.from(hexhash, 'hex'), fs.createReadStream(req.attachments[hexhash]))
        }
      }
    }
  }

  // validate all references are available
  const missing = await attachmentStore.listMissing([...new Set(listReferences(req.body).map(x => x.hash.toString('hex')))])
  if (missing.length > 0) {
    return res.set('X-Pigeon-Optics-Resend-With-Attachments', missing.join(',')).sendStatus(400)
  }

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

      const references = [...new Set(listReferences(req.body).map(x => x.hash.toString('hex')))]
      // first, write any attachments included in a form-data request body
      if (req.attachments) {
        for (const hexhash of references) {
          if (req.attachments[hexhash]) {
            const dataPath = codec.path.encode('datasets', req.params.user, req.params.name, req.params.recordID)
            await attachmentStore.writeHashedStream(dataPath, Buffer.from(hexhash, 'hex'), fs.createReadStream(req.attachments[hexhash]))
          }
        }
      }

      // validate all references are available
      const missing = await attachmentStore.listMissing([...new Set(listReferences(req.body).map(x => x.hash.toString('hex')))])
      if (missing.length > 0) {
        return res.set('X-Pigeon-Optics-Resend-With-Attachments', missing.join(',')).sendStatus(400)
      }

      // write record
      const { version } = await dataset.writeEntry(req.params.user, req.params.name, req.params.recordID, req.body)

      if (req.accepts('html')) {
        return res.redirect(303, uri`/datasets/${req.params.user}:${req.params.name}/records/${req.params.recordID}`)
      } else {
        return req.set('X-Version', version).sendStatus(204)
      }
    } catch (err) {
      error = err.message
    }
  } else if (req.method === 'DELETE') {
    if (!req.owner) return next(createError.Unauthorized('You do not have write access to this dataset'))
    const { version } = await dataset.deleteEntry(req.params.user, req.params.name, req.params.recordID)
    if (req.accepts('html')) {
      return res.redirect(303, uri`/datasets/${req.params.user}:${req.params.name}/`)
    } else {
      return res.set('X-Version', version).sendStatus(204)
    }
  }

  const record = await dataset.readEntry(req.params.user, req.params.name, req.params.recordID)
  if (!record) return next(createError.NotFound('Record Not Found'))

  if (req.accepts('html')) {
    const sidebar = {
      recordIDs: await dataset.listEntries(req.params.user, req.params.name)
    }

    const title = `${req.params.user}:${req.params.name}/${req.params.recordID}`
    if ((req.query.edit && req.owner) || req.method !== 'GET') {
      res.sendVibe('dataset-record-editor', title, {
        sidebar,
        recordID: req.params.recordID,
        recordData: codec.json.print(record, '\t')
      }, error)
    } else {
      res.sendVibe('dataset-record', title, { record, sidebar })
    }
  } else {
    codec.respond(req, res, record)
  }
})

module.exports = router
