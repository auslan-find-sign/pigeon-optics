// given an express request, if the body is multipart/form-data, streams attachments in to the attachment store
// and copies the cbor/json data in to req.body
const Busboy = require('busboy')
const HttpError = require('http-errors')
const settings = require('../models/settings')
const crypto = require('crypto')
const codec = require('../models/codec')
const xbytes = require('xbytes')
const destroy = require('destroy')
const finished = require('on-finished')
const os = require('os')
const fs = require('fs')
const path = require('path')

function getTempFilePath () {
  const rand = `${Math.round(Math.random() * 0xFFFFFF)}-${Math.round(Math.random() * 0xFFFFFF)}-${Math.round(Math.random() * 0xFFFFFF)}`
  return path.join(os.tmpdir(), `pigeon-optics-${rand}`)
}

// express middleware, modifies req to have an attachments object, with sha256 hex keys, and values that are file paths
// temp files will be automatically removed after the request is finished
module.exports = async function (req, res, next) {
  if (req.is('multipart/form-data') && req.user) {
    const bus = new Busboy({
      headers: req.headers,
      limits: { fileSize: xbytes.parse(settings.maxAttachmentSize).bytes }
    })

    const gcFileList = []
    bus.on('file', (fieldname, stream, filename, encoding, mimetype) => {
      if (fieldname === 'attachment' || fieldname === 'attachment[]') {
        const tempFile = getTempFilePath()
        const file = fs.createWriteStream(tempFile)
        const hash = crypto.createHash('sha256')
        stream.pause()
        stream.on('data', chunk => { hash.update(chunk) })
        stream.on('end', () => {
          req.attachments = req.attachments || {}
          req.attachments[hash.digest('hex')] = tempFile
          gcFileList.push(tempFile)
        })
        stream.pipe(file)
      } else if (fieldname === 'body') {
        const chunks = []
        let length = 0
        stream.on('data', (chunk) => {
          length += chunk.length
          if (length <= xbytes.parse(settings.maxRecordSize).bytes) {
            chunks.push(chunk)
          } else {
            destroy(bus)
            next(new HttpError(400, `body data too large, limit is ${settings.maxRecordSize}`))
          }
        })
        stream.on('end', () => {
          if (mimetype === 'application/cbor') {
            req.body = codec.cbor.decode(Buffer.concat(chunks))
          } else if (mimetype === 'application/json') {
            req.body = codec.json.decode(Buffer.concat(chunks).toString('utf-8'))
          } else {
            throw new HttpError(400, 'body file in multipart/form-data must be either application/cbor or application/json')
          }
        })
      } else {
        stream.resume()
      }
    })

    finished(bus, () => next())
    req.pipe(bus)
    // remove any files that are left in place
    finished(res, async () => {
      for (const filepath of gcFileList) {
        try {
          await fs.promises.unlink(filepath)
        } catch (err) {
          // nothing
        }
      }
    })
  } else {
    next()
  }
}
