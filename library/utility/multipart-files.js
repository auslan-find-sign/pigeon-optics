// given an express request, if the body is multipart/form-data, streams attachments in to the attachment store
// and copies the cbor/json data in to req.body
// const settings = require('../models/settings')
const crypto = require('crypto')
const codec = require('../models/codec')
// const xbytes = require('xbytes')
const finished = require('on-finished')
const blob = require('../models/file/blob')
const multipart = require('it-multipart')
const { Readable } = require('stream')
const ctype = require('content-type')
const cdisp = require('content-disposition')
const asyncIterableToArray = require('./async-iterable-to-array')
const { resolveContentIDs } = require('./record-structure')

// const maxAttachment = xbytes.parseSize(settings.maxAttachmentSize)
// const maxRecord = xbytes.parseSize(settings.maxRecordSize)

/**
 * Middleware which parses multipart files in the way Pigeon Optics supports and expects
 * Attachments are written out to hashed files and made available via
 *  - req.filesByHash - string hex hash of file's contents is the key, value is the file object with read and readStream methods
 *  - req.filesByName - string filename as supplied by client is key, value is the file object
 *  - req.filesByField - string key is form field name as supplied by client, value is an array of file objects
 *  - and req.files - array of all file objects
 * Files are automatically cleaned out at the end of http response, so they need to be copied or processed fully before res closes
 * @param {import('express/lib/request')} req - express Request object
 * @param {import('express/lib/response')} res - express Response object
 * @param {function} next - express next() function
 */
module.exports = async function (req, res, next) {
  req.filesByHash = {}
  req.filesByName = {}
  req.filesByField = {}
  req.files = []
  req.body = req.body || {}

  if (req.is('multipart/form-data')) {
    const randomID = crypto.randomBytes(32).toString('hex')
    const storage = blob.instance({ rootPath: ['uploads', randomID] })

    req.on('error', () => {
      storage.delete()
    })

    for await (const { headers, body } of multipart(req)) {
      const contentType = ctype.parse(headers['content-type'])
      const { encoding } = contentType.parameters
      const contentDisp = cdisp.parse(headers['content-disposition'])
      const { name, filename } = contentDisp.parameters

      if (filename && name !== 'body') {
        // it's a file
        const hash = await storage.writeStream(Readable.from(body))

        const read = storage.read.bind(storage, hash)
        const readStream = storage.readStream.bind(storage, hash)
        const file = { hash, field: name, filename, storage, read, readStream, type: contentType.type, encoding }
        req.files.push(file)
        req.filesByHash[hash.toString('hex')] = file
        req.filesByName[filename] = file
        if (['content-id'] in headers) req.filesByName[headers['content-id']] = file
        req.filesByField[name] = (req.filesByField[name] || [])
        req.filesByField[name].push(file)
      } else {
        let value
        const encoder = codec.for(contentType.type)
        if (encoder && encoder.decode) {
          value = encoder.decode(Buffer.concat(await asyncIterableToArray(body)))
        } else if (contentType.type === 'text/plain') {
          value = Buffer.concat(await asyncIterableToArray(body)).toString(encoding || 'utf-8')
        } else {
          value = Buffer.concat(await asyncIterableToArray(body))
        }

        if (name === 'body' && encoder && encoder.decode) {
          req.body = value
        } else {
          req.body[name] = value
        }
      }
    }

    // resolve any cid: URLs in the body data structure
    req.body = resolveContentIDs(req.body, req.filesByName)

    finished(res, () => {
      storage.delete()
    })
  }

  next()
}
