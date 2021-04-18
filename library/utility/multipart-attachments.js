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
    } else {
      attachments.writeStream(file.stream, { linkers: [] }).then(({ hash, release }) => {
        cb(null, { path: attachments.getPath(hash), hash, release })
      }).catch(err => cb(err))
    }
  },
  _removeFile: async function (req, file, cb) {
    if (file.release) file.release()
    cb(null)
  }
}

const multerInstance = multer({
  limits: { fileSize: xbytes.parse(settings.maxAttachmentSize).bytes },
  storage: uploadEngine
}).fields([
  { name: 'body', maxCount: 1 },
  { name: 'attachment' },
  { name: 'file' }
])

const postProcess = async function (req, res, next) {
  req.attachedFilesByHash = {}
  req.attachedFilesByName = {}
  const tasks = []

  if (req.files) {
    if (Array.isArray(req.files.attachment) || Array.isArray(req.files.file)) {
      for (const file of [...(req.files.attachment || []), ...(req.files.file || [])]) {
        if (file.originalname) {
          req.attachedFilesByName[file.originalname] = file
        }

        const hexHash = file.hash.toString('hex')
        req.attachedFilesByHash[hexHash] = file
        // if file has a release function to release reference hold and allow GC, call it when the response is finished
        if (typeof file.release === 'function') {
          finished(res, file.release)
        }
      }
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
