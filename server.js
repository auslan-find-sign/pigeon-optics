// server.js
// This is the application server for the Sign Dataset
const defaults = require('./package.json').defaults
const express = require('express')
const cookieSession = require('cookie-session')
const crypto = require('crypto')
const process = require('process')
const codec = require('./library/models/codec')
const Vibe = require('./library/vibe/rich-builder')
const homepageView = require('./library/views/homepage')
const errorView = require('./library/views/error-handler')

// create web server
const app = express()

// add sendVibe helper
app.use((req, res, next) => {
  res.sendVibe = (viewName, title, ...args) => {
    Vibe.docStream(title, v => {
      const view = require(`./library/views/${viewName}`)
      view.call(v, req, ...args).call(v, v)
    }).pipe(res.type('html'))
  }
  next()
})

// If forms are submitted, parse the data in to request.query and request.body
app.use(express.urlencoded({ extended: true }))
// If JSON is submitted, parse that in to request.body
app.use(express.raw({ limit: defaults.maxPostSize, type: ['application/json', 'application/cbor'] }))
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

// enable response compression
app.use(require('compression')())

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
app.use('/npm', express.static('node_modules'))

app.get('/', (req, res) => {
  Vibe.docStream('Datasets Project', homepageView(req)).pipe(res.type('html'))
})

app.use((error, req, res, next) => {
  if (error.code === 'ENOENT') {
    res.status(404) // something tried to read a file that doesn't exist
  } else if (error.name === 'SyntaxError' || error.stack.includes('/borc/src/decoder.js')) {
    res.status(400) // parse errors are likely to be clients sending malformed data
  } else {
    res.status(500)
  }

  if (req.accepts('html')) {
    Vibe.docStream('Request Error', errorView(req, error)).pipe(res.type('html'))
  } else {
    codec.respond(req, res, { error: error.message })
  }
})

const port = process.env.PORT || 3000
app.listen(port, () => {
  console.log(`Application Server ready at http://localhost:${port}/`)
})
