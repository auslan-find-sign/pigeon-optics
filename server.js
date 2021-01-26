// server.js
// This is the application server for the Sign Dataset
const express = require('express')
const cookieSession = require('cookie-session')
const crypto = require('crypto')
const process = require('process')
// Phoenix's UI toolkit
// const ui = require('./library/ui')
const serverTools = require('./library/server-tools')
// const Bell = require('./library/bell')

// const html = require('nanohtml')

// create web server
const app = express()

// If forms are submitted, parse the data in to request.query and request.body
app.use(express.urlencoded({ extended: true }))
// If JSON is submitted, parse that in to request.body
app.use(express.json())

// Give the users a crypto signed cookie, to store session information
// If you'd like your cookies to keep working between app edits, make sure to check out the .env file!
app.use(cookieSession({
  secret: process.env.COOKIE_SECRET || crypto.randomBytes(64).toString('base64')
}))

// make all the files in 'public' available
// https://expressjs.com/en/starter/static-files.html
app.use(express.static('public'))

// this allows web browsers to download a compiled version of the UI toolkit's javascript code
app.use(serverTools.clientScriptsMiddleware())

app.get('/', (req, res) => {
  // foo
  res.send('foo')
})

// datasets controller
app.use(require('./library/controllers/auth-controller'))
// app.use(require('./library/controllers/dataset-controller'))
// app.use(require('./library/controllers/lens-controller'))

app.listen(process.env.PORT || 3000, () => {
  console.log('Application Server ready')
})
