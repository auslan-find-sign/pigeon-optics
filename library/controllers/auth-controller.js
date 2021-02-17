const express = require('express')

const auth = require('../models/auth')
const dataset = require('../models/dataset')
const lens = require('../models/lens')

const codec = require('../models/codec')
const itToArray = require('../utility/async-iterable-to-array')

const router = express.Router()

// get a list of datasets owned by a specific user
router.get('/auth/login', (req, res) => {
  res.sendVibe('login', 'Login', { return: req.query.return || req.get('Referrer') || '/' })
})

router.post('/auth/login', async (req, res) => {
  try {
    req.session.auth = await auth.login(req.body.username, req.body.password)
    res.redirect(req.body.return)
  } catch (err) {
    res.sendVibe('login', 'Login', req.body, err.message)
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
      res.sendVibe('login', 'Login', req.body, err.message)
    }
  }
})

router.get('/auth/logout', (req, res) => {
  delete req.session.auth
  res.redirect(req.query.return || req.get('Referrer') || '/')
})

router.get('/users/', async (req, res) => {
  const list = await itToArray(auth.iterateUsers())
  if (req.accepts('html')) {
    res.sendVibe('user-list', 'Users', { list })
  } else {
    codec.respond(req, res, list)
  }
})

router.get('/users/:user/', async (req, res) => {
  const profile = await auth.getProfile(req.params.user)
  const datasets = await dataset.listDatasets(req.params.user)
  const lenses = await lens.listDatasets(req.params.user)

  if (req.accepts('html')) {
    res.sendVibe('user-profile', `${req.params.user}’s Profile`, profile, datasets, lenses)
  } else {
    codec.respond(req, res, {
      auth: profile.auth,
      datasets,
      lenses
    })
  }
})

module.exports = router
