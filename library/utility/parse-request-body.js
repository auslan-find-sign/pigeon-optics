/**
 * middlewares to parse request bodies
 */
const createHttpError = require('http-errors')
const codec = require('../models/codec')

/**
 * @typedef {import('express').Request} ExpressRequest
 */

/**
 * given an express request object, promise resolves with a decoded object from the request's body, or undefined
 * @param {ExpressRequest} req - request object with unbuffered stream of body
 * @param {object} [options] - options for request parsing
 * @param {number} [options.maxSize=32000000] - max size of request body, in whatever serialisation it's presented as
 * @returns {*|undefined} body decoded
 */
exports.requestToSingleObject = async function requestToSingleObject (req, { maxSize = 32000000 } = {}) {
  const format = codec.for(req.get('content-type'))

  if (format && typeof format.decode === 'function') {
    const buffers = []
    let totalSize = 0
    for await (const chunk of req) {
      totalSize += chunk.length
      if (totalSize > maxSize) throw createHttpError(413)
      buffers.push(chunk)
    }

    const result = format.decode(Buffer.concat(buffers))
    return result
  }
}

/**
 * given an express request object, async generator yields objects up to max size until request is fully ingested
 * @param {ExpressRequest} req - request object with unbuffered stream of body
 * @param {object} [options] - options for request parsing
 * @param {number} [options.maxSize=32000000] - max size of request body, in whatever serialisation it's presented as
 * @yields {*|undefined} body decoded
 */
exports.requestToObjectsIterator = async function * requestToObjectsIterator (req, { maxSize = 32000000 }) {
  const format = codec.for(req.get('content-type'))

  if (format && typeof format.decoder === 'function') {
    const stream = await format.decoder({ maxSize })
    req.pipe(stream)
    for await (const chunk of stream) {
      if (typeof format.nullSymbol === 'symbol' && chunk === format.nullSymbol) {
        yield null
      } else {
        yield chunk
      }
    }
  }
}
