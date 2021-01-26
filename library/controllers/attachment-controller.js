const express = require('express')
const router = express.Router()
const attachmentStore = require('../models/attachment-storage')
const fs = require('fs-extra')

// get a list of datasets owned by a specific user
router.get('/attachments/:hash([0-9A-Fa-f]{32})', async (req, res, next) => {
  const localPath = attachmentStore.getPath(req.params.hash)
  if (await fs.pathExists(localPath)) {
    res.sendFile(localPath, {
      immutable: true,
      maxAge: '1 year',
      headers: {
        'Content-Security-Policy': 'sandbox',
        'Content-Type': req.query.type ? `${req.query.type}` : 'application/octet-stream'
      }
    })
  } else {
    next()
  }
})

module.exports = router
