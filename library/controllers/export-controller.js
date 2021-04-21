const express = require('express')
const router = express.Router()

const updateEvents = require('../utility/update-events')
const attachments = require('../models/attachments')
const readPath = require('../models/read-path')
const codec = require('../models/codec')
const uri = require('encodeuricomponent-tag')

const { Readable } = require('stream')
const ZipStream = require('zip-stream')
const expresse = require('@toverux/expresse')
const onFinished = require('on-finished')
const createHttpError = require('http-errors')

/**
 * iterator which yields chunks of text or buffer in whichever encoding is requested
 * @param {string} path - path in form '/realm/user:name'
 * @param {object} opts - query string options
 * @param {string|number} [opts.at] - version number, records with a lower number than this will output a stub without a data field
 * @yields {string|Buffer}
 */
async function * pathQuery (dataPath, { at }) {
  if (at !== undefined && typeof at !== 'number') {
    at = parseInt(at)
    if (isNaN(at)) at = undefined
  }

  const filter = ({ version }) => at === undefined || version >= at

  for await (const { path, version, hash, read } of readPath.meta(dataPath)) {
    const { recordID } = codec.path.decode(path)
    if (filter({ version })) {
      yield { id: recordID, version, hash, data: await read() }
    } else {
      yield { id: recordID, version, hash }
    }
  }
}

function streamArchive (dataPath, archiveType, encoder, includeAttachments) {
  if (archiveType !== 'zip') throw new Error('Archiving only supports zip currently')
  const zip = new ZipStream({ comment: `Archive of ${dataPath}` })

  // promisify the entry append thing
  const entry = (...args) => {
    return new Promise((resolve, reject) => {
      zip.entry(...args, (err, out) => err ? reject(new Error(err)) : resolve(out))
    })
  }

  const run = async () => {
    const writtenAttachments = new Set()
    // make directories
    await entry(null, { name: '/records/' })
    if (includeAttachments) await entry(null, { name: '/attachments/' })

    for await (const { path, data, links } of readPath(dataPath)) {
      const { recordID } = codec.path.decode(path)
      // zip-stream support for entry contents being strings or buffers seems broken
      // but stream inputs works, so just make streams
      // output cbor version
      const recordStream = Readable.from([encoder.encode(data)])
      await entry(recordStream, { name: uri`/records/${recordID}.${encoder.extensions[0]}` })

      // write any attachments
      if (includeAttachments) {
        for (const link of links) {
          const url = new URL(link)
          if (url.protocol.toLowerCase() === 'hash:' && url.host.toLowerCase() === 'sha256') {
            const hexHash = (new URL(link)).pathname.slice(1)

            if (!writtenAttachments.has(hexHash)) {
              writtenAttachments.add(hexHash)
              await entry(attachments.readStream(hexHash), { name: uri`/attachments/${hexHash}` })
            }
          }
        }
      }
    }

    zip.finalize()
  }

  run()
  return zip
}

/**
 * Exports a readable dataset in the requested format (anything codec can stream - implements encoder() function)
 * Format can be specified either via .ext or Accepts header
 * ?at=(number) subsets the response to omit data field on any entries whose version number is less than the number
 * provided, allowing for more efficient pull syncing
 */
router.get(`/:source(datasets|lenses)/:user\\::name/export.:format(${codec.exts.join('|')})?`, async (req, res) => {
  const path = codec.path.encode(req.params)

  if (!await readPath.exists(path)) {
    throw createHttpError.NotFound('Data Not Found')
  }

  const encoder = codec.for(req.params.format || req.accepts(Object.keys(codec.mediaTypeHandlers)))
  if (encoder && typeof encoder.encoder === 'function') {
    const mediaType = req.accepts(encoder.handles) || encoder.handles[0] // try to respond with the Content-Type asked for, otherwise use a default
    res.type(mediaType)
    Readable.from(pathQuery(codec.path.encode(req.params), req.query)).pipe(encoder.encoder()).pipe(res)
  } else {
    throw createHttpError.NotAcceptable('Encoder for requested format not available')
  }
})

/**
 * export a dataset/viewport output as a zip file
 */
router.get(`/:source(datasets|lenses)/:user\\::name/archive.:format(${codec.exts.join('|')}).zip`, async (req, res) => {
  const path = codec.path.encode(req.params)

  if (!await readPath.exists(path)) {
    return createHttpError.NotFound('Data Not Found')
  }

  if (!codec.for(req.params.format)) {
    return createHttpError.NotFound(`Format ${req.params.format} not available`)
  }

  res.attachment(`export-${req.params.name.replace(/[^a-zA-Z0-9-_]+/g, '_')}-${req.params.format}.zip`)
  streamArchive(path, 'zip', codec.for(req.params.format), !!req.query.attachments).pipe(res)
})

/**
 * stream out changes to a lens or dataset's contents
 */
router.get('/:source(datasets|lenses|meta)/:user\\::name/event-stream', expresse.sse({ flushAfterWrite: true }), async (req, res) => {
  const sources = {
    datasets: require('../models/dataset'),
    lenses: require('../models/lens'),
    meta: require('../models/meta-vfs')
  }

  function send (info) {
    res.sse.data({ ...info })
  }

  // send's current version of dataset
  const model = sources[req.params.source]
  const version = (await model.readMeta(req.params.user, req.params.name)).version
  const { source, user, name } = req.params
  const path = codec.path.encode(req.params.source, req.params.user, req.params.name)
  send({ path, source, user, name, version })

  // watch for further updates, until the response closes
  updateEvents.events.on('update', send)
  onFinished(res, () => {
    updateEvents.events.off('update', send)
  })
})

module.exports = router
