const express = require('express')

const auth = require('../models/auth')
const dataset = require('../models/dataset')
const lens = require('../models/lens')

const codec = require('../models/codec')
const itToArray = require('../utility/async-iterable-to-array')

const router = express.Router()

router.all('/auth', async (req, res) => {
  let error = false
  if (req.method === 'POST' && req.body && req.body.username && req.body.password) {
    try {
      if (req.body.register) {
        req.session.auth = await auth.register(req.body.username, req.body.password)
      } else {
        req.session.auth = await auth.login(req.body.username, req.body.password)
      }
      return res.redirect(req.body.return)
    } catch (err) {
      error = err.message
    }
  }

  const form = {
    ...req.body || {},
    return: req.query.return || req.get('Referrer') || '/'
  }
  res.sendVibe('login', 'Login', form, error)
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
