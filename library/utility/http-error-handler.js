const createHttpError = require('http-errors')
const codec = require('../models/codec')

module.exports = ({ silent = false }) => {
  return async (error, req, res, next) => {
    if (res.headersSent) {
      return next(error) // delegate to default handler for situations where body is already returning
    }

    // automatically guess some things when random errors fly in to the handler
    if (!createHttpError.isHttpError(error)) {
      if (!(error instanceof Error)) {
        error = new Error(error)
      }

      error.status = error.statusCode = 500

      if (error.code === 'ENOENT') {
        error.status = error.statusCode = 404
      } else if (error.name === 'SyntaxError' || error.stack.includes('/borc/src/decoder.js')) {
        error.status = error.statusCode = 400
      }
    }

    if (!silent && req.path !== '/favicon.ico') {
      console.error(`For ${req.method} ${req.path}`)
      console.error(error.name + ' Error: ' + error.message)
      console.error(error.stack)
    }

    if (error.status || error.statusCode) res.status(error.status || error.statusCode)
    if (error.headers) res.set(error.headers)

    if (req.accepts('html')) {
      await res.sendVibe('error-handler', 'Request Error', error)
    } else {
      await codec.respond(req, res, {
        error: error.message,
        stack: req.auth === 'admin' && error.stack
      })
    }
  }
}
