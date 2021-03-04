// server.js
// This is the application server for the Sign Dataset
const settings = require('./library/models/settings')
const timestring = require('timestring')
const express = require('express')
const cookieSession = require('cookie-session')
const methodOverride = require('method-override')
const crypto = require('crypto')
const process = require('process')
const codec = require('./library/models/codec')
const Vibe = require('./library/vibe/rich-builder')

// create web server
const app = express()

// add sendVibe helper
app.use(Vibe.expressMiddleware)
Vibe.viewsPath = './library/views'
Vibe.iconPath = '/design/icomoon/symbol-defs.svg'

// enable response compression
app.use(require('compression')())

// If forms are submitted, parse the data in to request.query and request.body
app.use(express.urlencoded({ extended: true }))
// If JSON is submitted, parse that in to request.body
app.use(express.raw({ limit: settings.maxPostSize, type: ['application/json', 'application/cbor'] }))
app.use((req, res, next) => {
  try {
    if (req.is('application/json')) {
      req.body = codec.json.decode(req.body.toString())
    } else if (req.is('application/cbor')) {
      req.body = codec.cbor.decode(req.body)
    }
    next()
  } catch (err) {
    codec.respond(req, res.status(415), { err: `Problem parsing request body: ${err.message}` })
  }
})

// allow forms to override method using Rails ?_method= format
app.use(methodOverride((req, res) => (req.query && req.query._method) || (req.body && req.body._method) || req.method))

// allow non-credentialed cors requests to anything by default
app.use((req, res, next) => {
  res.set('Access-Control-Allow-Origin', '*')
  next()
})

// Give the users a crypto signed cookie, to store session information
// If you'd like your cookies to keep working between app edits, make sure to check out the .env file!
app.use(cookieSession({
  secret: process.env.SECRET || crypto.randomBytes(64).toString('base64')
}))

app.use(require('./library/models/auth').basicAuthMiddleware)

// make all the files in 'public' available
// https://expressjs.com/en/starter/static-files.html
app.use(express.static('public'))

app.use(require('./library/controllers/auth-controller'))
app.use(require('./library/controllers/attachment-controller'))
app.use(require('./library/controllers/dataset-controller'))
app.use(require('./library/controllers/lens-controller'))
app.use(require('./library/controllers/export-controller'))
app.use(require('./library/controllers/meta-controller'))
app.use('/npm', express.static('node_modules'))

app.get('/', (req, res) => {
  res.sendVibe('homepage', settings.title)
})

app.use((req, res, next) => {
  const err = new Error('Path not Found, web address maybe incorrect')
  err.httpCode = 404
  err.code = 'Path Not Found'
  throw err
})

app.use((error, req, res, next) => {
  if (error.httpCode) {
    res.status(error.httpCode)
  } else if (error.code === 'ENOENT') {
    res.status(404) // something tried to read a file that doesn't exist
  } else if (error.name === 'SyntaxError' || error.stack.includes('/borc/src/decoder.js')) {
    res.status(400) // parse errors are likely to be clients sending malformed data
  } else {
    res.status(500)
  }

  console.error(error.name + ' Error: ' + error.message)
  console.error(error.stack)

  if (req.accepts('html')) {
    res.sendVibe('error-handler', 'Request Error', error)
  } else {
    codec.respond(req, res, { error: error.message })
  }
})

if (settings.garbageCollectAttachmentsInterval) {
  const attachmentStore = require('./library/models/attachment-storage')
  function attachmentsGC () {
    attachmentStore.pruneRandom()
  }
  setInterval(attachmentsGC, timestring(settings.garbageCollectAttachmentsInterval, 'ms'))
}

const port = process.env.PORT || 3000
app.listen(port, '127.0.0.1', () => {
  console.log(`Application Server ready at http://localhost:${port}/`)
})
