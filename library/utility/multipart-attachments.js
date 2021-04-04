// given an express request, if the body is multipart/form-data, streams attachments in to the attachment store
// and copies the cbor/json data in to req.body
const multer = require('multer')
const settings = require('../models/settings')
const createHttpError = require('http-errors')
const crypto = require('crypto')
const codec = require('../models/codec')
const xbytes = require('xbytes')
const finished = require('on-finished')
const fs = require('fs')

const memStore = multer.memoryStorage()
const diskStore = multer.diskStorage({})
const uploadEngine = {
  _handleFile: async function (req, file, cb) {
    if (file.fieldname === 'body') {
      return memStore._handleFile(req, file, cb)
    } else if (file.fieldname === 'attachment') {
      return diskStore._handleFile(req, file, cb)
    }
  },
  _removeFile: function (req, file, cb) {
    if (file.path) fs.unlink(file.path, cb)
  }
}

const multerInstance = multer({
  limits: { fileSize: xbytes.parse(settings.maxAttachmentSize).bytes },
  storage: uploadEngine
}).fields([
  { name: 'body', maxCount: 1 },
  { name: 'attachment' }
])

const postProcess = async function (req, res, next) {
  req.attachedFilesByHash = {}
  req.attachedFilesByName = {}
  const tasks = []

  if (req.files) {
    if (Array.isArray(req.files.attachment)) {
      for (const file of req.files.attachment) {
        if (file.originalname) req.attachedFilesByName[file.originalname] = file

        tasks.push(new Promise((resolve, reject) => {
          const hash = fs.createReadStream(file.path).pipe(crypto.createHash('sha256'))
          hash.setEncoding('hex')
          hash.on('data', hex => {
            file.hash = hex
            req.attachedFilesByHash[hex] = file
            resolve()
          })
          hash.on('error', reject)
        }))
      }

      // clean up after request finishes
      finished(res, async () => {
        for (const file of req.files.attachment) {
          try { await fs.promises.unlink(file.path) } catch (err) {
            // nothing
          }
        }
      })
    }

    if (req.files.body && req.files.body[0]) {
      const bodyInfo = req.files.body[0]
      const specificCodec = codec.for(bodyInfo.mimetype)
      if (specificCodec && typeof specificCodec.decode === 'function') {
        Object.assign(req.body, specificCodec.decode(bodyInfo.buffer))
      } else {
        return next(new createHttpError.BadRequest('Unsupported body mime type'))
      }
    }
  }

  Promise.all(tasks).then(x => next()).catch(x => next(x))
}

module.exports = [multerInstance, postProcess]
