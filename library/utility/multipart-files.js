// given an express request, if the body is multipart/form-data, streams attachments in to the attachment store
// and copies the cbor/json data in to req.body
const multer = require('multer')
const settings = require('../models/settings')
const createHttpError = require('http-errors')
const HashThrough = require('hash-through')
const crypto = require('crypto')
const codec = require('../models/codec')
const xbytes = require('xbytes')
const finished = require('on-finished')
const fs = require('fs/promises')

const memStore = multer.memoryStorage()
const diskStore = multer.diskStorage({ })
const uploadEngine = {
  _handleFile: function (req, file, cb) {
    const hashStream = new HashThrough(() => crypto.createHash('sha256'))
    file.stream.pipe(hashStream)
    const proxyFile = { ...file, stream: hashStream }
    const proxyCb = (err, ...args) => {
      if (!err) {
        const hash = hashStream.digest('hex')
        return cb(err, { hash, ...args[0] })
      }
      cb(err, ...args)
    }

    if (file.fieldname === 'body') {
      return memStore._handleFile(req, proxyFile, proxyCb)
    } else {
      return diskStore._handleFile(req, proxyFile, proxyCb)
    }
  },
  _removeFile: async function (req, file, cb) {
    if (file.buffer) return memStore._removeFile(req, file, cb)
    else if (file.path) return diskStore._removeFile(req, file, cb)
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
  req.filesByHash = {}
  req.filesByName = {}
  const tasks = []

  if (req.files) {
    if (Array.isArray(req.files.attachment) || Array.isArray(req.files.file)) {
      for (const file of [...(req.files.attachment || []), ...(req.files.file || [])]) {
        if (file.originalname) req.filesByName[file.originalname] = file
        req.filesByHash[file.hash] = file

        // if file has a release function to release reference hold and allow GC, call it when the response is finished
        if (file.path) {
          finished(res, async () => {
            try {
              await fs.unlink(file.path)
            } catch (err) {
              // no big deal, we tried
            }
          })
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
