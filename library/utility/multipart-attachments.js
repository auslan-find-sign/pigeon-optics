// given an express request, if the body is multipart/form-data, streams attachments in to the attachment store
// and copies the cbor/json data in to req.body
const multer = require('multer')
const settings = require('../models/settings')
const createHttpError = require('http-errors')
const attachments = require('../models/attachments')
const codec = require('../models/codec')
const xbytes = require('xbytes')
const finished = require('on-finished')

const memStore = multer.memoryStorage()
const uploadEngine = {
  _handleFile: function (req, file, cb) {
    if (file.fieldname === 'body') {
      return memStore._handleFile(req, file, cb)
    } else if (file.fieldname === 'attachment') {
      attachments.writeStream(file.stream, { linkers: [] }).then(hash => {
        cb(null, { path: attachments.getPath(hash), hash })
      }).catch(err => cb(err))
    }
  },
  _removeFile: async function (req, file, cb) {
    if (file.hash) {
      await attachments.validate(file.hash)
    }
    cb(null)
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
        if (file.hash) req.attachedFilesByHash[file.hash.toString('hex')] = file
      }

      // clean up after request finishes
      finished(res, async () => {
        for (const file of req.files.attachment) {
          if (file.hash) await attachments.validate(file.hash)
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
