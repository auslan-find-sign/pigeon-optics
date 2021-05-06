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
exports.one = async function parseOneObjectFromRequest (req, { maxSize = 32000000 } = {}) {
  const format = codec.for(req.get('content-type'))

  if (format && typeof format.decode === 'function') {
    const buffers = []
    let totalSize = 0
    for await (const chunk of req) {
      totalSize += chunk.length
      if (totalSize > maxSize) throw createHttpError(413, `Request Body too large, max size is ${maxSize} bytes`)
      buffers.push(chunk)
    }

    const result = format.decode(Buffer.concat(buffers))
    return result
  }
}

/**
 * Create middleware which uses .one() to parse request in to req.body if codecs can parse it
 * @param {Object} [options]
 * @param {number} [options.maxSize=32000000] - max size of body in bytes
 */
exports.body = function ({ maxSize = 32000000 } = {}) {
  return async (req, res, next) => {
    if (req.is('application/x-www-form-urlencoded')) {
      const buffers = []
      let totalSize = 0
      for await (const chunk of req) {
        totalSize += chunk.length
        if (totalSize > maxSize) throw createHttpError(413, `Request Body too large, max size is ${maxSize} bytes`)
        buffers.push(chunk)
      }

      const params = new URLSearchParams(Buffer.concat(buffers).toString('utf-8'))
      req.body = Object.fromEntries(params.entries())
      return next()
    } else {
      try {
        const data = await exports.one(req)
        if (data !== undefined) req.body = data
        next()
      } catch (err) {
        if (createHttpError.isHttpError(err)) return next(err)
        else return next(createHttpError.BadRequest())
      }
    }
  }
}

/**
 * given an express request object, async generator yields objects up to max size until request is fully ingested
 * @param {ExpressRequest} req - request object with unbuffered stream of body
 * @param {object} [options] - options for request parsing
 * @param {number} [options.maxSize=32000000] - max size of request body, in whatever serialisation it's presented as
 * @yields {*|undefined} body decoded
 */
exports.iterate = async function * iterateObjectsFromRequest (req, { maxSize = 32000000 } = {}) {
  const format = codec.for(req.get('content-type'))

  if (format && typeof format.decoder === 'function') {
    const stream = await format.decoder({ maxSize })
    const nullObj = format.nullSymbol || null
    for await (const chunk of req.pipe(stream)) {
      if (chunk === nullObj) {
        yield null
      } else {
        yield chunk
      }
    }
  }
}
