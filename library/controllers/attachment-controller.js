const express = require('express')
const router = express.Router()
const attachments = require('../models/attachments')
const codec = require('../models/codec')

// stream the contents of an attachment by it's content hash
router.get('/attachments/:hash([0-9A-Fa-f]{64})', async (req, res) => {
  const stream = await attachments.readStream(req.params.hash)
  const expireDays = 365
  const expireSeconds = expireDays * 60 * 60 * 24
  res.set('Cache-Control', `public, max-age=${expireSeconds}, immutable`)
  res.set('Content-Security-Policy', 'sandbox')
  res.set('Content-Type', req.query.type ? `${req.query.type}` : 'application/octet-stream')
  stream.pipe(res)
})

router.get('/attachments/:hash([0-9A-Fa-f]{64})/meta', async (req, res) => {
  const meta = await attachments.readMeta(req.params.hash)
  await codec.respond(req, res, meta)
})

module.exports = router
