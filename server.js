// server.js
// This is the application server for the Sign Dataset
const settings = require('./library/models/settings')
const express = require('express')
require('express-async-errors')
const cookieSession = require('cookie-session')
const methodOverride = require('method-override')
const crypto = require('crypto')
const process = require('process')
const codec = require('./library/models/codec')
const Vibe = require('./library/vibe/rich-builder')
const createHttpError = require('http-errors')

// create web server
const app = express()

// add sendVibe helper
app.use(Vibe.expressMiddleware)
Vibe.viewsPath = './library/views'
Vibe.iconPath = '/design/icomoon/symbol-defs.svg'

// enable response compression
app.use(require('compression')({}))

// If forms are submitted, parse the data in to request.query and request.body
app.use(express.urlencoded({ extended: true }))

// handle decoding json and cbor
app.use(express.raw({ limit: settings.maxRecordSize, type: Object.keys(codec.mediaTypeHandlers) }))

app.use((req, res, next) => {
  const reqType = req.is(...Object.keys(codec.mediaTypeHandlers))
  if (reqType) {
    const specificCodec = codec.for(reqType)
    req.body = specificCodec.decode(req.body)
  }

  next()
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

// log requests
app.use((req, res, next) => {
  console.info(`req ${req.method} ${req.path}`)
  if (req.method !== 'GET') {
    for (const [name, value] of Object.entries(req.headers)) console.info(`  - ${name}: ${value}`)
    if (req.body) {
      console.info('Body:')
      console.info(req.body)
    }
  }
  next()
})

app.use(require('./library/models/auth').basicAuthMiddleware)

// make all the files in 'public' available
// https://expressjs.com/en/starter/static-files.html
app.use(express.static('public'))
app.use('/npm', express.static('node_modules'))

app.use(require('./library/controllers/auth-controller'))
app.use(require('./library/controllers/attachment-controller'))
app.use(require('./library/controllers/dataset-controller'))
app.use(require('./library/controllers/lens-controller'))
app.use(require('./library/controllers/export-controller'))
app.use(require('./library/controllers/meta-controller'))

app.get('/', (req, res) => {
  res.sendVibe('homepage', settings.title)
})

app.use((req, res, next) => {
  next(createHttpError.NotFound('Path not Found, web address maybe incorrect'))
})

app.use(require('./library/utility/http-error-handler')({ silent: false }))

const port = process.env.PORT || 3000
app.listen(port, '127.0.0.1', () => {
  console.log(`Application Server ready at http://localhost:${port}/`)
})
