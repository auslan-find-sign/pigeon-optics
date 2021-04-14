const createHttpError = require('http-errors')
const codec = require('../models/codec')

module.exports = ({ silent = false }) => {
  return (error, req, res, next) => {
    if (res.headersSent) {
      return next(error) // delegate to default handler for situations where body is already returning
    }

    if (createHttpError.isHttpError(error)) {
      if (error.status) res.status(error.status)
      if (error.headers) res.set(error.headers)
    } else if (error.code === 'ENOENT') {
      res.status(404) // something tried to read a file that doesn't exist
    } else if (error.name === 'SyntaxError' || error.stack.includes('/borc/src/decoder.js')) {
      res.status(400) // parse errors are likely to be clients sending malformed data
    } else {
      res.status(500)
    }

    if (!silent && req.path !== '/favicon.ico') {
      console.error(`For ${req.method} ${req.path}`)
      console.error(error.name + ' Error: ' + error.message)
      console.error(error.stack)
    }

    if (req.accepts('html')) {
      res.sendVibe('error-handler', 'Request Error', error)
    } else {
      codec.respond(req, res, {
        error: error.message,
        stack: req.auth === 'admin' && error.stack
      })
    }
  }
}
