const express = require('express')
const router = express.Router()
const ui = require('../ui')
const auth = require('../models/auth')
const serverTools = require('../server-tools')
// const defaults = require('../../package.json').defaults
const uri = require('encodeuricomponent-tag')

// get a list of datasets owned by a specific user
router.get('/auth/login', (req, res) => {
  const memo = [
    ui.paragraph({
      contents: [
        'Login with an existing account here, or ',
        ui.link({ url: uri`register?return=${req.query.return || '/'}`, contents: 'register a new account' })
      ]
    })
  ]

  if (req.query.err) {
    memo.push(ui.paragraph({ contents: [ui.glitch('Error: '), req.query.err] }))
  }

  serverTools.sendWebpage(req, res, {
    title: 'Login to Datasets',
    contents: [
      ui.simpleForm({
        title: 'Login to Datasets',
        memo,
        url: uri`login?return=${req.query.return || '/'}`,
        method: 'POST',
        fields: {
          username: { type: 'text', value: req.query.username },
          password: { type: 'password' }
        },
        buttonLabel: 'Login'
      })
    ]
  })
})

router.post('/auth/login', async (req, res) => {
  try {
    req.session.auth = await auth.login(req.body.username, req.body.password)
    res.redirect(req.query.return)
  } catch (err) {
    res.redirect(uri`/auth/login?username=${req.body.username}&err=${err.message}&return=${req.query.return}`)
  }
})

// get a list of datasets owned by a specific user
router.get('/auth/register', (req, res) => {
  const memo = [
    ui.paragraph({
      contents: [
        'Create a new account, or ',
        ui.link({ url: uri`login?return=${req.query.return || '/'}`, contents: 'login to an existing account' })
      ]
    })
  ]

  if (req.query.err) {
    memo.push(ui.paragraph({ contents: [ui.glitch('Error: '), req.query.err] }))
  }

  serverTools.sendWebpage(req, res, {
    title: 'Register with Datasets',
    contents: [
      ui.simpleForm({
        title: 'Register with Datasets',
        memo,
        url: `register?return=${req.query.return || '/'}`,
        method: 'POST',
        fields: {
          username: { type: 'text', value: req.query.username },
          password: { type: 'password' }
        },
        buttonLabel: 'Register'
      })
    ]
  })
})

router.post('/auth/register', async (req, res) => {
  try {
    req.session.auth = await auth.register(req.body.username, req.body.password)
    res.redirect(req.query.return)
  } catch (err) {
    try {
      req.session.auth = await auth.login(req.body.username, req.body.password)
      res.redirect(req.query.return)
    } catch (err2) {
      res.redirect(uri`/auth/register?username=${req.body.username}&err=${err.message}&return=${req.query.return}`)
    }
  }
})

router.get('/auth/logout', (req, res) => {
  delete req.session.auth
  res.redirect(req.query.return || req.get('Referrer') || '/')
})

module.exports = router
