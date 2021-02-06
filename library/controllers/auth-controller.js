const express = require('express')

const auth = require('../models/auth')
const dataset = require('../models/dataset')
const lens = require('../models/lens')

const codec = require('../models/codec')

const Vibe = require('../vibe/rich-builder')
const loginView = require('../views/login')
const profileView = require('../views/user-profile')

const router = express.Router()

// get a list of datasets owned by a specific user
router.get('/auth/login', (req, res) => {
  Vibe.docStream('Login', loginView(req, { return: req.query.return || req.get('Referrer') || '/' })).pipe(res.type('html'))
})

router.post('/auth/login', async (req, res) => {
  try {
    req.session.auth = await auth.login(req.body.username, req.body.password)
    res.redirect(req.body.return)
  } catch (err) {
    Vibe.docStream('Login', loginView(req, req.body, err.message)).pipe(res.type('html'))
  }
})

router.post('/auth/register', async (req, res) => {
  try {
    req.session.auth = await auth.register(req.body.username, req.body.password)
    res.redirect(req.body.return)
  } catch (err) {
    try {
      req.session.auth = await auth.login(req.body.username, req.body.password)
      res.redirect(req.body.return)
    } catch (err2) {
      Vibe.docStream('Login', loginView(req, req.body, err.message)).pipe(res.type('html'))
    }
  }
})

router.get('/auth/logout', (req, res) => {
  delete req.session.auth
  res.redirect(req.query.return || req.get('Referrer') || '/')
})

router.get('/users/:user', async (req, res) => {
  const profile = await auth.getProfile(req.params.user)
  const datasets = await dataset.listDatasets(req.params.user)
  const lenses = await lens.listDatasets(req.params.user)

  if (req.accepts('html')) {
    Vibe.docStream(`${req.params.user}’s Profile`, profileView(req, profile, datasets, lenses)).pipe(res.type('html'))
  } else {
    codec.respond(req, res, {
      auth: profile.auth,
      datasets,
      lenses
    })
  }
})

module.exports = router
