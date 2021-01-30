const express = require('express')
const router = express.Router()

const readPath = require('../models/read-path')
const codec = require('../models/codec')
const uri = require('encodeuricomponent-tag')

const { Readable } = require('stream')

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
  for await (const [recordID, recordData] of readPath(path)) {
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
function streamPath (path, encoding) {
  return Readable.from(encodePath(path, encoding))
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
  streamPath(path, req.query.encoding).pipe(res)
})

module.exports = router
