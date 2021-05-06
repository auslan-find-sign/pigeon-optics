const express = require('express')
const router = module.exports = express.Router()

const auth = require('../models/auth')
const codec = require('../models/codec')
const dataset = require('../models/dataset')
const uri = require('encodeuricomponent-tag')
const createError = require('http-errors')
const multipartFiles = require('../utility/multipart-files')
const autoImport = require('../utility/auto-import-attachments')
const parse = require('../utility/parse-request-body')
const createHttpError = require('http-errors')

// add req.owner boolean for any routes with a :author param
router.param('author', auth.ownerParam)

// list all authors and their datasets
router.get('/datasets/', async (req, res) => {
  const list = {}
  for await (const author of auth.iterate()) {
    const datasets = await dataset.list(author)
    if (datasets && datasets.length > 0) {
      list[author] = datasets
    }
  }

  if (req.accepts('html')) {
    res.sendVibe('dataset-list', 'Public Datasets', { list })
  } else {
    codec.respond(req, res, list)
  }
})

// get a list of datasets owned by a specific author
router.get('/datasets/:author\\:', async (req, res) => {
  const datasets = await dataset.list(req.params.author)

  if (req.accepts('html')) {
    res.sendVibe('dataset-list', `${req.params.author}’s Datasets`, { list: { [req.params.author]: datasets } })
  } else {
    codec.respond(req, res, datasets)
  }
})

// form for creating a new dataset
router.all('/datasets/create', auth.required, parse.body(), async (req, res) => {
  const state = { name: '', memo: '', ...req.body || {}, create: true }
  let error = false

  if (req.method === 'PUT' && req.body) {
    try {
      await dataset.create(req.author, req.body.name, { memo: req.body.memo })
      return res.redirect(303, uri`/datasets/${req.author}:${req.body.name}/`)
    } catch (err) {
      if (!req.accepts('html')) throw err
      error = err.message
    }
  }

  res.sendVibe('dataset-config-editor', 'Create a Dataset', state, error)
})

// list dataset info and records
router.get('/datasets/:author\\::name/', async (req, res) => {
  const config = await dataset.readMeta(req.params.author, req.params.name)

  if (req.accepts('html')) {
    res.sendVibe('dataset-index', `${req.params.author}’s “${req.params.name}” Dataset`, { config })
  } else {
    codec.respond(req, res, {
      author: req.params.author,
      name: req.params.name,
      ...config
    })
  }
})

// delete a dataset
router.delete('/datasets/:author\\::name/', auth.ownerRequired, async (req, res) => {
  await dataset.delete(req.params.author, req.params.name)

  if (req.accepts('html')) {
    res.redirect(303, '/datasets/')
  } else {
    res.sendStatus(204)
  }
})

router.all('/datasets/:author\\::name/configuration', auth.ownerRequired, parse.body(), async (req, res) => {
  const config = await dataset.readMeta(req.params.author, req.params.name)
  let error = false

  if (req.method === 'PUT') {
    try {
      await dataset.updateMeta(req.params.author, req.params.name, meta => {
        meta.memo = req.body.memo
        return meta
      })
      if (req.accepts('html')) return res.redirect(303, uri`/datasets/${req.params.author}:${req.params.name}/`)
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
router.all('/datasets/:author\\::name/create-record', auth.ownerRequired, parse.body(), async (req, res) => {
  const title = `Creating a record inside ${req.params.author}:${req.params.name}`
  const state = {
    create: true,
    recordID: '',
    recordData: '{\n  \n}\n',
    ...req.body || {}
  }

  let error
  if (req.method === 'PUT') {
    try {
      const path = codec.path.encode('datasets', req.params.author, req.params.name, req.body.recordID)
      const data = await autoImport(req, path, codec.json.decode(req.body.recordData))
      await dataset.write(req.params.author, req.params.name, req.body.recordID, data)
      return res.redirect(303, path)
    } catch (err) {
      error = err.message
    }
  }
  res.sendVibe('dataset-record-editor', title, state, error)
})

router.all('/datasets/:author\\::name/records/', multipartFiles, async (req, res) => {
  if (req.method === 'GET' || req.method === 'HEAD') {
    const config = await dataset.readMeta(req.params.author, req.params.name)
    const records = await dataset.list(req.params.author, req.params.name)
    res.set('X-Version', config.version)
    res.set('ETag', `"${config.version}"`)
    codec.respond(req, res, Object.fromEntries(records.map(({ id, version, hash }) => [id, { version, hash }])))
  } else {
    if (!req.owner) throw createHttpError.Unauthorized()
    if (!['POST', 'PUT'].includes(req.method)) throw createHttpError.MethodNotAllowed('GET, POST, PUT supported')
    const overwrite = req.method === 'PUT'
    const filesMode = req.files.length > 0

    async function * filesIter () {
      for (const filename in req.filesByName) {
        const format = codec.for(filename)
        if (format) {
          const id = filename.split(/[\\/]/).slice(-1)[0].split('.').slice(0, -1).join('.')
          const data = format.decode(await req.filesByName[filename].read())
          yield [id, data]
        }
      }
    }
    async function * bodyIter () {
      for await (const item of parse.iterate(req)) {
        if (Array.isArray(item) && item.length === 2) {
          const data = await autoImport(req, codec.path.encode('datasets', req.params.author, req.params.name, item[0]), item[1])
          yield [`${item[0]}`, data]
        } else if (typeof item === 'object' && Object.keys(item).length === 2) {
          if (typeof item.id !== 'string') throw createHttpError(400, 'entry objects must contain string "id" field')
          if (!('data' in item.data)) throw createHttpError(400, 'objects must contain "data" field')
          const data = await autoImport(req, codec.path.encode('datasets', req.params.author, req.params.name, item.id), item.data)
          yield [item.id, data]
        }
      }
    }

    await dataset.writeEntries(req.params.author, req.params.name, filesMode ? filesIter() : bodyIter(), { overwrite })

    return res.sendStatus(204)
  }
})

// get a record from a author's dataset
router.all('/datasets/:author\\::name/records/:recordID', multipartFiles, parse.body(), async (req, res, next) => {
  let error

  if (req.method === 'PUT') {
    if (!req.owner) next(createError.Unauthorized('You do not have write access to this dataset'))
    try {
      if (req.is('urlencoded')) {
        req.body = codec.json.decode(req.body.recordData)
      }

      const data = await autoImport(req, codec.path.encode('datasets', req.params.author, req.params.name, req.params.recordID), req.body)

      // write record
      await dataset.write(req.params.author, req.params.name, req.params.recordID, data)

      if (req.accepts('html')) {
        return res.redirect(303, uri`/datasets/${req.params.author}:${req.params.name}/records/${req.params.recordID}`)
      } else {
        return req.sendStatus(204)
      }
    } catch (err) {
      error = err.message
    }
  } else if (req.method === 'DELETE') {
    if (!req.owner) return next(createError.Unauthorized('You do not have write access to this dataset'))
    await dataset.delete(req.params.author, req.params.name, req.params.recordID)
    if (req.accepts('html')) {
      return res.redirect(303, uri`/datasets/${req.params.author}:${req.params.name}/`)
    } else {
      return res.sendStatus(204)
    }
  }

  const record = await dataset.read(req.params.author, req.params.name, req.params.recordID)
  if (!record) return next(createError.NotFound('Record Not Found'))

  if (req.accepts('html')) {
    const sidebar = { recordIDs: Object.keys((await dataset.readMeta(req.params.author, req.params.name)).records) }

    const title = `${req.params.author}:${req.params.name}/${req.params.recordID}`
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
router.all('/datasets/:author\\::name/import', auth.ownerRequired, multipartFiles, async (req, res) => {
  const state = { mode: req.body.mode || 'files', overwrite: req.body.overwrite === 'true' }

  if (req.method === 'PUT') {
    state.wroteCount = 0
    async function * generator () {
      if (state.mode === 'files') {
        // import files by filename
        for (const filename in req.filesByName) {
          const fileCodec = codec.for(filename.toLowerCase())
          if (fileCodec) {
            console.log('importing', filename)
            const ext = fileCodec.extensions.find(x => filename.endsWith(`.${x}`))
            const recordID = filename.slice(0, filename.length - (ext.length + 1))
            const recordData = fileCodec.decode(await req.filesByName[filename].read())
            const recordPath = codec.path.encode('datasets', req.params.author, req.params.name, recordID)
            yield [recordID, await autoImport(req, recordPath, recordData)]
            state.wroteCount += 1
          }
        }
      } else {
        // import a single file using streaming decoding
        const file = req.filesByField.file[0]
        if (!file) throw new Error('No file provided')

        const fileCodec = codec.for(file.filename.toLowerCase()) || codec.for(file.type)
        if (!fileCodec) throw new Error('Unsupported file type')

        for (const entry of (await file.readStream()).pipe(fileCodec.decoder())) {
          if (Array.isArray(entry)) {
            if (entry.length !== 2) throw new Error('entries style array bodies must have two elements, id and data')
            yield entry
          } else if (typeof entry === 'object') {
            if (typeof entry.id !== 'string') throw new Error('object style bodies must have a string id property')
            if (!('data' in entry)) throw new Error('object style bodies must have a data property containing record data')

            const path = codec.path.encode('datasets', req.params.author, req.params.name, entry.id)
            const data = await autoImport(req, path, entry.data)
            yield [entry.id, data]
          }
          state.wroteCount += 1
        }
      }
    }

    await dataset.writeEntries(req.params.author, req.params.name, generator(), { overwrite: state.overwrite })
  }

  res.sendVibe('dataset-import', 'Import Files', state)
})
