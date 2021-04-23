const Vibe = require('../../vibe/rich-builder')
const layout = require('../../views/layout')
const streams = require('stream')
const codec = require('./index')
const json = require('./json')

/**
 * @typedef {import('express').Request} Request
 * @typedef {import('express').Response} Response
 */

/**
 * Respond to an expressjs web request, with an object encoded as JSON, CBOR, or a stylised webpage according to Accepts header
 * @param {Request} req - expressjs http request object
 * @param {Response} res - expressjs http response object
 * @param {*} object - object to send back as JSON, CBOR, or a stylised webpage
 */
module.exports = async function respond (req, res, object) {
  const bestMatch = req.accepts(['text/html', ...Object.keys(codec.mediaTypeHandlers)])
  const handler = codec.for(bestMatch)

  if (object[Symbol.asyncIterator]) { // AsyncIterators will stream out as an array or some kind of list
    if (!bestMatch || bestMatch === 'text/html' || !handler) {
      await new Promise((resolve, reject) => {
        Vibe.docStream('API Object Response Stream', layout(req, async v => {
          await v.panel(async v => {
            v.heading('API Object Response Stream:')

            for await (const entry of object) {
              v.sourceCode(json.print(entry, 2))
            }
          })
        })).pipe(res).on('close', () => resolve()).on('error', e => reject(e))
      })
    } else {
      res.type(bestMatch)

      const inputStream = object instanceof streams.Readable ? object : streams.Readable.from(object)
      const encoder = inputStream.pipe(handler.encoder())
      encoder.pipe(res)
      return new Promise((resolve, reject) => {
        encoder.on('end', resolve)
        encoder.on('error', reject)
      })
    }
  } else {
    if (!bestMatch || bestMatch === 'text/html' || !handler) {
      return new Promise((resolve, reject) => {
        Vibe.docStream('API Object Response', layout(req, v => {
          v.panel(v => {
            v.heading('API Object Response:')
            v.sourceCode(json.print(object, 2))
          })
        })).pipe(res).on('close', () => resolve()).on('error', e => reject(e))
      })
    } else {
      res.type(bestMatch).send(handler.encode(object))
    }
  }
}
