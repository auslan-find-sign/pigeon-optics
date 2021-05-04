const express = require('express')
const router = express.Router()
const attachments = require('../models/attachments')
const codec = require('../models/codec')

// stream the contents of an attachment by it's content hash
router.get('/attachments/:hash([0-9A-Fa-f]{64})', async (req, res) => {
  const release = attachments.hold(req.params.hash)
  res.sendFile(attachments.getPath(req.params.hash), {
    immutable: true,
    maxAge: '1 year',
    headers: {
      'Content-Security-Policy': 'sandbox',
      'Content-Type': req.query.type ? `${req.query.type}` : 'application/octet-stream'
    }
  }, function done (err) {
    if (err) console.warn('error during attachment download:', err)
    release()
  })
})

router.get('/attachments/:hash([0-9A-Fa-f]{64})/meta', async (req, res) => {
  const meta = await attachments.readMeta(req.params.hash)
  await codec.respond(req, res, meta)
})

module.exports = router
