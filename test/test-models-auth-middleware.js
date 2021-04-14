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
  res.send({ user: req.user, auth: req.auth })
})

app.get('/test-auth-required', auth.required, (req, res) => {
  res.send({ user: req.user, auth: req.auth })
})

app.param('user', auth.ownerParam)
app.get('/test-owner-param/:user', (req, res) => {
  res.send({ owner: req.owner })
})

app.get('/test-owner-required/:user', auth.ownerRequired, (req, res) => {
  res.send({ user: req.user, auth: req.auth })
})

app.use(require('../library/utility/http-error-handler')({ silent: true }))

describe('models/auth express middleware', function () {
  this.timeout(200)

  const testUser = `test-user-${crypto.randomBytes(32).toString('hex')}`
  const testAdmin = `test-admin-${crypto.randomBytes(32).toString('hex')}`
  const testPass = crypto.randomBytes(32).toString('hex')

  let server
  before(async () => {
    await Promise.all([
      auth.register(testUser, testPass),
      auth.register(testAdmin, testPass, 'admin'),
      new Promise((resolve, reject) => {
        server = app.listen(3000, (err) => err ? reject(err) : resolve())
      })
    ])
  })

  it('auth.basicAuthMiddleware works for regular users', async () => {
    const res = await superagent.get('http://localhost:3000/test-basic-auth')
      .auth(testUser, testPass)
      .accept('json')

    expect(res.body).to.deep.equal({ user: testUser, auth: 'user' })
  })

  it('auth.basicAuthMiddleware works for admin users', async () => {
    const res = await superagent.get('http://localhost:3000/test-basic-auth')
      .auth(testAdmin, testPass)
      .accept('json')

    expect(res.body).to.deep.equal({ user: testAdmin, auth: 'admin' })
  })

  it('auth.basicAuthMiddleware works without auth', async () => {
    const res = await superagent.get('http://localhost:3000/test-basic-auth')
      .accept('json')

    expect(res.body).to.deep.equal({ })
  })

  it('auth.basicAuthMiddleware errors well with incorrect username', async () => {
    const res = await superagent.get('http://localhost:3000/test-basic-auth')
      .auth(testUser + '-wrong-username', testPass)
      .ok(() => true)
      .accept('json')

    expect(res.status).to.equal(400)
  })

  it('auth.basicAuthMiddleware errors well with incorrect password', async () => {
    const res = await superagent.get('http://localhost:3000/test-basic-auth')
      .auth(testUser, 'wrong-password')
      .ok(() => true)
      .accept('json')

    expect(res.status).to.equal(400)
  })

  it('auth.ownerParam sets req.owner to false with different user', async () => {
    const owner = crypto.randomBytes(32).toString('hex')
    const res = await superagent.get(`http://localhost:3000/test-owner-param/${owner}`)
      .auth(testUser, testPass)
      .accept('json')

    expect(res.body).to.deep.equal({ owner: false })
  })

  it('auth.ownerParam sets req.owner to true with same user', async () => {
    const res = await superagent.get(`http://localhost:3000/test-owner-param/${testUser}`)
      .auth(testUser, testPass)
      .accept('json')

    expect(res.body).to.deep.equal({ owner: true })
  })

  it('auth.ownerParam sets req.owner to true with admin user', async () => {
    const res = await superagent.get(`http://localhost:3000/test-owner-param/${testUser}`)
      .auth(testAdmin, testPass)
      .accept('json')

    expect(res.body).to.deep.equal({ owner: true })
  })

  it('auth.required accepts authed users', async () => {
    const res = await superagent.get('http://localhost:3000/test-auth-required')
      .auth(testUser, testPass)
      .accept('json')

    expect(res.body).to.deep.equal({ user: testUser, auth: 'user' })
  })

  it('auth.required kicks back unauthenticated users', async () => {
    const res = await superagent.get('http://localhost:3000/test-auth-required')
      .ok(() => true)
      .accept('json')

    expect(res.status).to.equal(401)
    expect(res.header['www-authenticate']).to.be.a('string').and.include('Basic')
  })

  it('auth.ownerRequired accepts owner', async () => {
    const res = await superagent.get(`http://localhost:3000/test-owner-required/${testUser}`)
      .auth(testUser, testPass)
      .accept('json')

    expect(res.body).to.deep.equal({ user: testUser, auth: 'user' })
  })

  it('auth.ownerRequired kicks back different users', async () => {
    const res = await superagent.get(`http://localhost:3000/test-owner-required/${testAdmin}`)
      .auth(testUser, testPass)
      .ok(() => true)
      .accept('json')

    expect(res.status).to.equal(403)
  })

  after(async () => {
    server.close()
    await Promise.all([
      auth.delete(testUser),
      auth.delete(testAdmin)
    ])
  })
})
