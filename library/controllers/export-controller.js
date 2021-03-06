const express = require('express')
const router = express.Router()

const readPath = require('../models/read-path')
const codec = require('../models/codec')
const attach = require('../models/attachment')
const attachStorage = require('../models/attachment-storage')
const uri = require('encodeuricomponent-tag')
const pkg = require('../../package.json')
const updateEvents = require('../utility/update-events')

const { Readable } = require('stream')
const ZipStream = require('zip-stream')
const expresse = require('@toverux/expresse')
const onFinished = require('on-finished')
const fs = require('fs-extra')

const encodingMimeTypes = {
  cbor: 'application/cbor',
  json: 'application/json',
  'json-lines': 'text/plain'
}

/**
 * iterator which yields chunks of text or buffer in whichever encoding is requested
 * @param {string} path - path in form '/realm/user:name'
 * @param {object} opts - query string options
 * @param {string} opts.encoding - 'cbor', 'json', or 'json-lines'
 * @param {string} [opts.at] - version number string, only output records with this version number or higher
 * @param {string} [opts.after] - version number string, only output records with a newer version than this
 * @yields {string|Buffer}
 */
async function * encodePath (dataPath, opts) {
  const { encoding, after, at } = opts
  if (encoding === 'json') yield '{\n'
  let first = true
  for await (const { path, version, read } of readPath.meta(dataPath)) {
    if (after !== undefined && version <= parseInt(after)) continue
    if (at !== undefined && version < parseInt(at)) continue

    const data = await read()
    const { recordID } = codec.path.decode(path)
    if (encoding === 'cbor') {
      yield codec.cbor.encode([recordID, data])
    } else if (encoding === 'json') {
      if (first) {
        yield `  ${codec.json.encode(recordID)}:${codec.json.encode(data)}`
      } else {
        yield `,\n  ${codec.json.encode(recordID)}:${codec.json.encode(data)}`
      }
    } else if (encoding === 'json-lines') {
      yield `${codec.json.encode([recordID, data])}\n`
    }
    first = false
  }
  if (encoding === 'json') yield '\n}\n'
}

/**
 * creates a node readable stream which outputs export data from the specified path
 * @param {string} path - path in form '/realm/user:name'
 * @param {object} opts - query string options
 * @param {string} opts.encoding - 'cbor', 'json', or 'json-lines'
 * @param {string} [opts.at] - version number string, only output records with this version number or higher
 * @param {string} [opts.after] - version number string, only output records with a newer version than this
 * @returns {Readable}
 */
function readableStreamOfPath (...args) {
  return Readable.from(encodePath(...args))
}

function streamArchive (dataPath, archiveType, includeAttachments) {
  if (archiveType !== 'zip') throw new Error('Archiving only supports zip currently')
  const zip = new ZipStream({
    comment: `Archive of ${dataPath}, built by Datasets v${pkg.version}`
  })

  // promisify the entry append thing
  const entry = (...args) => {
    return new Promise((resolve, reject) => {
      zip.entry(...args, (err, out) => err ? reject(new Error(err)) : resolve(out))
    })
  }

  const run = async () => {
    const writtenAttachments = new Set()
    // make directories
    await entry(null, { name: '/cbor/' })
    await entry(null, { name: '/json/' })
    if (includeAttachments) await entry(null, { name: '/attachments/' })

    for await (const { path, data } of readPath(dataPath)) {
      const { recordID } = codec.path.decode(path)
      // zip-stream support for entry contents being strings or buffers seems broken
      // but stream inputs works, so just make streams
      // output cbor version
      const cborStream = Readable.from((async function * () {
        yield codec.cbor.encode(data)
      })())
      await entry(cborStream, { name: uri`/cbor/${recordID}.cbor` })
      // output json version
      const jsonStream = Readable.from((async function * () {
        yield Buffer.from(codec.json.encode(data, 2))
      })())
      await entry(jsonStream, { name: uri`/json/${recordID}.json` })
      // write any attachments
      if (includeAttachments) {
        const refs = attach.listReferences(data)
        for (const ref of refs) {
          const hexHash = ref.hash.toString('hex')
          if (!writtenAttachments.has(hexHash)) {
            writtenAttachments.add(hexHash)
            const path = attachStorage.getPath(ref)
            const readStream = fs.createReadStream(path)
            await entry(readStream, { name: uri`/attachments/${hexHash}` })
          }
        }
      }
    }

    zip.finalize()
  }

  run()
  return zip
}

// export a dataset/viewport output
// query string must specify encoding as one of the following:
//  - cbor: returns a cbor stream of arrays containing [entryID, entryData]
//  - json-lines: returns a text file, where each line is a json array in the same format as cbor, followed by newlines \n
//  - json: returns a json object where each key is an entryID and each value is entry data
// json-lines maybe easier to process with large datasets, as you can just read a line in at a time
router.get('/:source(datasets|lenses)/:user\\::name/export', async (req, res) => {
  const path = uri`/${req.params.realm}/${req.params.user}:${req.params.name}`
  const mimeType = encodingMimeTypes[req.query.encoding]

  if (!mimeType) {
    return res.status('500').send('Unsupported encoding')
  }

  if (!await readPath.exists(path)) {
    return res.status('404').send('Underlying data not found')
  }

  res.type(mimeType)
  readableStreamOfPath(path, req.query).pipe(res)
})

/**
 * export a dataset/viewport output as a zip file
 */
router.get('/:source(datasets|lenses)/:user\\::name/zip', async (req, res) => {
  const path = codec.path.encode(req.params)

  if (!await readPath.exists(path)) {
    return res.status('404').send('Underlying data not found')
  }

  streamArchive(path, 'zip', !!req.query.attachments).pipe(res.type('application/zip'))
})

/**
 * stream out changes to a lens or dataset's contents
 */
router.get('/:source(datasets|lenses)/:user\\::name/event-stream', expresse.sse({ flushAfterWrite: true }), async (req, res) => {
  const sources = {
    datasets: require('../models/dataset'),
    lenses: require('../models/lens')
  }
  const source = sources[req.params.source]

  async function send () {
    const snapshot = await source.readVersion(req.params.user, req.params.name)
    if (snapshot) {
      // make a records collection with just version numbers as values
      const records = Object.fromEntries(
        Object.entries(snapshot.records).forEach(([id, { version }]) =>
          [id, version]
        )
      )

      res.sse.data({ version: snapshot.version, records })
      return true
    }
    return false
  }

  function cb () { send() }
  updateEvents.events.on('update', cb)
  onFinished(res, () => { updateEvents.events.off('update', cb) })

  send() // send's current version of underlying dataset
})

module.exports = router
