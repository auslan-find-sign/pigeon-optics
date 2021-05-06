const express = require('express')

const auth = require('../models/auth')
const dataset = require('../models/dataset')
const lens = require('../models/lens')

const codec = require('../models/codec')
const parse = require('../utility/parse-request-body')

const router = express.Router()

router.all('/auth', parse.body({ maxSize: 8192 }), async (req, res) => {
  let error = false
  if (req.method === 'POST' && req.body && req.body.name && req.body.password) {
    try {
      if (req.body.register) {
        req.session.auth = await auth.register(req.body.name, req.body.password)
      } else {
        req.session.auth = await auth.login(req.body.name, req.body.password)
      }
      return res.redirect(303, req.body.return)
    } catch (err) {
      error = err.message
    }
  }

  const form = {
    return: req.query.return || req.get('Referrer') || '/',
    ...req.body || {}
  }
  res.sendVibe('login', 'Login', form, error)
})

router.get('/auth/logout', (req, res) => {
  delete req.session.auth
  res.redirect(303, req.query.return || req.get('Referrer') || '/')
})

router.get('/authors/', async (req, res) => {
  if (req.accepts('html')) {
    res.sendVibe('author-list', 'Authors', { list: auth.iterate() })
  } else {
    codec.respond(req, res, auth.iterate())
  }
})

router.get('/authors/:author/', async (req, res) => {
  const profile = await auth.getProfile(req.params.author)
  const datasets = await dataset.list(req.params.author)
  const lenses = await lens.list(req.params.author)

  if (req.accepts('html')) {
    res.sendVibe('author-profile', `${req.params.author}’s Profile`, profile, datasets, lenses)
  } else {
    codec.respond(req, res, {
      auth: profile.auth,
      datasets,
      lenses
    })
  }
})

module.exports = router
