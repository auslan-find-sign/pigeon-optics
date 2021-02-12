const express = require('express')
const router = express.Router()

const readPath = require('../models/read-path')
const codec = require('../models/codec')
const attach = require('../models/attachment')
const attachStorage = require('../models/attachment-storage')
const uri = require('encodeuricomponent-tag')
const pkg = require('../../package.json')

const { Readable } = require('stream')
const ZipStream = require('zip-stream')
const fs = require('fs-extra')

const encodingMimeTypes = {
  cbor: 'application/cbor',
  json: 'application/json',
  'json-lines': 'text/plain'
}

/**
 * iterator which yields chunks of text or buffer in whichever encoding is requested
 * @param {string} path - path in form '/realm/user:name'
 * @param {string} encoding - 'cbor', 'json', or 'json-lines'
 */
async function * encodePath (path, encoding) {
  if (encoding === 'json') yield '{\n'
  for await (const [recordPath, recordData] of readPath(path)) {
    const { recordID } = codec.path.decode(recordPath)
    if (encoding === 'cbor') {
      yield codec.cbor.encode([recordID, recordData])
    } else if (encoding === 'json') {
      yield `  ${codec.json.encode(recordID)}:${codec.json.encode(recordData)}\n`
    } else if (encoding === 'json-lines') {
      yield `${codec.json.encode([recordID, recordData])}\n`
    }
  }
  if (encoding === 'json') yield '}\n'
}

/**
 * creates a node readable stream which outputs export data from the specified path
 * @param {string} path - path in form '/realm/user:name'
 * @param {string} encoding - 'cbor', 'json', or 'json-lines'
 */
function readableStreamOfPath (path, encoding) {
  return Readable.from(encodePath(path, encoding))
}

function streamArchive (path, archiveType, includeAttachments) {
  if (archiveType !== 'zip') throw new Error('Archiving only supports zip currently')
  const zip = new ZipStream({
    comment: `Archive of ${path}, built by Datasets v${pkg.version}`
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

    for await (const [recordPath, recordData] of readPath(path)) {
      const { recordID } = codec.path.decode(recordPath)
      // zip-stream support for entry contents being strings or buffers seems broken
      // but stream inputs works, so just make streams
      // output cbor version
      const cborStream = Readable.from((async function * () {
        yield codec.cbor.encode(recordData)
      })())
      await entry(cborStream, { name: uri`/cbor/${recordID}.cbor` })
      // output json version
      const jsonStream = Readable.from((async function * () {
        yield Buffer.from(codec.json.encode(recordData, 2))
      })())
      await entry(jsonStream, { name: uri`/json/${recordID}.json` })
      // write any attachments
      if (includeAttachments) {
        const refs = attach.listReferences(recordData)
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
router.get('/export/:realm(datasets|viewports)/:user\\::name', async (req, res) => {
  const path = uri`/${req.params.realm}/${req.params.user}:${req.params.name}`
  const mimeType = encodingMimeTypes[req.query.encoding]

  if (!mimeType) {
    return res.status('500').send('Unsupported encoding')
  }

  if (!await readPath.exists(path)) {
    return res.status('404').send('Underlying data not found')
  }

  res.type(mimeType)
  readableStreamOfPath(path, req.query.encoding).pipe(res)
})

/**
 * export a dataset/viewport output as a zip file
 */
router.get('/export/:realm(datasets|viewports)/:user\\::name/zip', async (req, res) => {
  const path = uri`/${req.params.realm}/${req.params.user}:${req.params.name}`

  if (!await readPath.exists(path)) {
    return res.status('404').send('Underlying data not found')
  }

  streamArchive(path, 'zip', !!req.query.attachments).pipe(res.type('application/zip'))
})

/**
 * stream out changes to a lens or dataset's contents
 */
router.get('/stream/:realm(datasets|viewports)/:user\\::name', async (req, res) => {

})

module.exports = router
