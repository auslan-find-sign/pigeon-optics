const assert = require('assert')
const multipart = require('../library/utility/multipart-attachments')
const express = require('express')
const crypto = require('crypto')
const fs = require('fs')
const chai = require('chai')
chai.use(require('chai-http'))

// test data
const testBody = {
  foo: true,
  bar: 'no thanks, i\'m sober'
}
const attach1 = crypto.randomBytes(256).toString('hex')
const attach2 = crypto.randomBytes(500).toString('hex')

function hashBuf (buf) {
  const hash = crypto.createHash('sha256')
  hash.update(buf)
  return hash.digest('hex')
}

const app = express()
app.use(multipart)

app.post('/test', async (req, res) => {
  console.log('server side body', req.body)
  const body = req.body
  const attachments = Object.fromEntries(await Promise.all(Object.entries(req.attachedFilesByHash).map(async ([key, val]) =>
    [key, await fs.promises.readFile(val.path).toString()]
  )))
  const filenames = Object.fromEntries(await Promise.all(Object.entries(req.attachedFilesByName).map(async ([key, val]) =>
    [key, await fs.promises.readFile(val.path).toString()]
  )))

  res.send({ body, attachments, filenames })
})

describe('library/utility/multipart-attachments', function () {
  it('decodes body as part of form-data', function (done) {
    chai.request(app)
      .post('/test')
      .attach('body', Buffer.from(JSON.stringify(testBody)), { contentType: 'application/json' })
      .end((err, res) => {
        if (err) return done(err)

        chai.assert.deepEqual(res.body.body, testBody, 'body should roundtrip correctly')

        done()
      })
  })

  it('decodes two attachments and body correctly', function (done) {
    chai.request(app)
      .post('/test')
      .attach('body', Buffer.from(JSON.stringify(testBody)), { contentType: 'application/json', filename: 'woo.json' })
      .attach('attachment', Buffer.from(attach1), { contentType: 'video/mp4', filename: 'clip.mp4' })
      .attach('attachment', Buffer.from(attach2), { contentType: 'application/zip', filename: 'resources.zip' })
      .end((err, res) => {
        if (err) return done(err)
        console.log('body:', res.body)
        chai.assert.deepEqual(res.body.body, testBody, 'body should roundtrip correctly')

        chai.assert.deepEqual(res.body.filenames, {
          'thingo.mp4': attach1,
          'lovely-dinner-set.zip': attach2
        }, 'filenames should be read correctly')

        chai.assert.deepEqual(res.body.attachments, {
          [hashBuf(attach1)]: attach1,
          [hashBuf(attach2)]: attach2
        }, 'attachments should hash correctly')

        done()
      })
  })
})
