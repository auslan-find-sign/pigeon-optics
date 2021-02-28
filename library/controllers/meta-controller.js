const express = require('express')
const router = express.Router()

const codec = require('../models/codec')
const metaVFS = require('../models/meta-vfs')

// list vfs
router.get('/meta/:user\\::name/', async (req, res) => {
  const list = await metaVFS.listEntries(req.params.user, req.params.name)
  codec.respond(req, res, list)
})

// list vfs
router.get('/meta/:user\\::name/records/', async (req, res) => {
  const list = await metaVFS.listEntries(req.params.user, req.params.name)
  codec.respond(req, res, list)
})

// get a record from meta vfs
router.get('/meta/:user\\::name/records/:recordID', async (req, res) => {
  const record = await metaVFS.readEntry(req.params.user, req.params.name, req.params.recordID)
  codec.respond(req, res, record)
})

module.exports = router
