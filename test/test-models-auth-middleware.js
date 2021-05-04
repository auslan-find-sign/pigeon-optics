const crypto = require('crypto')
const auth = require('../library/models/auth')

const chai = require('chai')
const superagent = require('superagent')
chai.use(require('chai-as-promised'))
const { expect } = chai

const express = require('express')
require('express-async-errors')
const Vibe = require('../library/vibe/rich-builder')
const app = express()

// add sendVibe helper
app.use(Vibe.expressMiddleware)
Vibe.viewsPath = '../library/views'
Vibe.iconPath = '/design/icomoon/symbol-defs.svg'

app.use(auth.basicAuthMiddleware)

app.get('/test-basic-auth', (req, res) => {
  res.send({ author: req.author, auth: req.auth })
})

app.get('/test-auth-required', auth.required, (req, res) => {
  res.send({ author: req.author, auth: req.auth })
})

app.param('author', auth.ownerParam)
app.get('/test-owner-param/:author', (req, res) => {
  res.send({ owner: req.owner })
})

app.get('/test-owner-required/:author', auth.ownerRequired, (req, res) => {
  res.send({ author: req.author, auth: req.auth })
})

app.use(require('../library/utility/http-error-handler')({ silent: true }))

describe('models/auth express middleware', function () {
  this.timeout(200)

  const testAccount = `test-regular-account-${crypto.randomBytes(32).toString('hex')}`
  const testAdmin = `test-admin-account-${crypto.randomBytes(32).toString('hex')}`
  const testPass = crypto.randomBytes(32).toString('hex')

  let server
  before(async () => {
    await Promise.all([
      auth.register(testAccount, testPass),
      auth.register(testAdmin, testPass, 'admin'),
      new Promise((resolve, reject) => {
        server = app.listen(3000, (err) => err ? reject(err) : resolve())
      })
    ])
  })

  it('auth.basicAuthMiddleware works for regular author accounts', async () => {
    const res = await superagent.get('http://localhost:3000/test-basic-auth')
      .auth(testAccount, testPass)
      .accept('json')

    expect(res.body).to.deep.equal({ author: testAccount, auth: 'regular' })
  })

  it('auth.basicAuthMiddleware works for admin author accounts', async () => {
    const res = await superagent.get('http://localhost:3000/test-basic-auth')
      .auth(testAdmin, testPass)
      .accept('json')

    expect(res.body).to.deep.equal({ author: testAdmin, auth: 'admin' })
  })

  it('auth.basicAuthMiddleware works without auth', async () => {
    const res = await superagent.get('http://localhost:3000/test-basic-auth')
      .accept('json')

    expect(res.body).to.deep.equal({ })
  })

  it('auth.basicAuthMiddleware errors well with incorrect author name', async () => {
    const res = await superagent.get('http://localhost:3000/test-basic-auth')
      .auth(testAccount + '-wrong-author-name', testPass)
      .ok(() => true)
      .accept('json')

    expect(res.status).to.equal(400)
  })

  it('auth.basicAuthMiddleware errors well with incorrect password', async () => {
    const res = await superagent.get('http://localhost:3000/test-basic-auth')
      .auth(testAccount, 'wrong-password')
      .ok(() => true)
      .accept('json')

    expect(res.status).to.equal(400)
  })

  it('auth.ownerParam sets req.owner to false with different author', async () => {
    const owner = crypto.randomBytes(32).toString('hex')
    const res = await superagent.get(`http://localhost:3000/test-owner-param/${owner}`)
      .auth(testAccount, testPass)
      .accept('json')

    expect(res.body).to.deep.equal({ owner: false })
  })

  it('auth.ownerParam sets req.owner to true with same author', async () => {
    const res = await superagent.get(`http://localhost:3000/test-owner-param/${testAccount}`)
      .auth(testAccount, testPass)
      .accept('json')

    expect(res.body).to.deep.equal({ owner: true })
  })

  it('auth.ownerParam sets req.owner to true with admin author', async () => {
    const res = await superagent.get(`http://localhost:3000/test-owner-param/${testAccount}`)
      .auth(testAdmin, testPass)
      .accept('json')

    expect(res.body).to.deep.equal({ owner: true })
  })

  it('auth.required accepts authed authors', async () => {
    const res = await superagent.get('http://localhost:3000/test-auth-required')
      .auth(testAccount, testPass)
      .accept('json')

    expect(res.body).to.deep.equal({ author: testAccount, auth: 'regular' })
  })

  it('auth.required kicks back unauthenticated authors', async () => {
    const res = await superagent.get('http://localhost:3000/test-auth-required')
      .ok(() => true)
      .accept('json')

    expect(res.status).to.equal(401)
    expect(res.header['www-authenticate']).to.be.a('string').and.include('Basic')
  })

  it('auth.ownerRequired accepts owner', async () => {
    const res = await superagent.get(`http://localhost:3000/test-owner-required/${testAccount}`)
      .auth(testAccount, testPass)
      .accept('json')

    expect(res.body).to.deep.equal({ author: testAccount, auth: 'regular' })
  })

  it('auth.ownerRequired kicks back different authors', async () => {
    const res = await superagent.get(`http://localhost:3000/test-owner-required/${testAdmin}`)
      .auth(testAccount, testPass)
      .ok(() => true)
      .accept('json')

    expect(res.status).to.equal(403)
  })

  after(async () => {
    server.close()
    await Promise.all([
      auth.delete(testAccount),
      auth.delete(testAdmin)
    ])
  })
})
