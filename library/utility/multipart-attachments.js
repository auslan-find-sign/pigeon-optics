// given an express request, if the body is multipart/form-data, streams attachments in to the attachment store
// and copies the cbor/json data in to req.body
const multer = require('multer')
const settings = require('../models/settings')
const createHttpError = require('http-errors')
const crypto = require('crypto')
const codec = require('../models/codec')
const xbytes = require('xbytes')
const finished = require('on-finished')
const os = require('os')
const fs = require('fs')
const path = require('path')

function getTempFilePath () {
  const rand = crypto.randomBytes(20).toString('hex')
  return path.join(os.tmpdir(), `pigeon-optics-${rand}`)
}

const uploadEngine = {
  _handleFile: async function (req, file, cb) {
    if (file.fieldname === 'body') {
      const chunks = []
      for await (const chunk of file.stream) chunks.push(chunk)
      if (file.mimetype === 'application/cbor') {
        req.body = codec.cbor.decode(Buffer.concat(chunks))
      } else if (file.mimetype === 'application/json') {
        req.body = codec.json.decode(Buffer.concat(chunks).toString('utf-8'))
      } else {
        throw createHttpError.BadRequest('Unsupported mime type on body file')
      }
      cb()
    } else if (file.fieldname === 'attachment') {
      const path = getTempFilePath()
      const writeStream = file.stream.pipe(fs.createWriteStream(path))
      writeStream.on('finished', () => {
        const hash = fs.createReadStream(path).pipe(crypto.createHash('sha256'))
        hash.setEncoding('hex')
        hash.on('data', hex => {
          cb(null, { path, size: writeStream.bytesWritten, hash: hex })
        })
      })
    }
  },
  _removeFile: function (req, file, cb) {
    fs.unlink(file.path, cb)
  }
}

const multerInstance = multer({
  limits: { fileSize: xbytes.parse(settings.maxAttachmentSize).bytes },
  storage: uploadEngine
}).fields([
  { name: 'body', maxCount: 1 },
  { name: 'attachment' }
])

const postProcess = function (req, res, next) {
  req.attachedFilesByHash = {}
  req.attachedFilesByName = {}

  if (req.files) {
    for (const file of req.files) {
      if (file.hash) req.attachedFilesByHash[file.hash] = file
      if (file.originalname) req.attachedFilesByName[file.originalname] = file
    }
  }

  if (req.files && req.files.length) {
    // clean up after request finishes
    finished(res, async () => {
      for (const file of req.files) {
        try { await fs.promises.unlink(file.path) } catch (err) {
          // ...
        }
      }
    })
  }

  next()
}

module.exports = [multerInstance, postProcess]
