const express = require('express')
const router = express.Router()
const attachments = require('../models/attachments')
const codec = require('../models/codec')

// get a list of datasets owned by a specific user
router.get('/attachments/:hash([0-9A-Fa-f]{64})', async (req, res) => {
  res.sendFile(attachments.getPath(req.params.hash), {
    immutable: true,
    maxAge: '1 year',
    headers: {
      'Content-Security-Policy': 'sandbox',
      'Content-Type': req.query.type ? `${req.query.type}` : 'application/octet-stream'
    }
  })
})

router.get('/attachments/:hash([0-9A-Fa-f]{64})/meta', async (req, res) => {
  const meta = await attachments.readMeta(req.params.hash)
  await codec.respond(req, res, meta)
})

module.exports = router
