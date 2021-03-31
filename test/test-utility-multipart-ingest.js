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
  const response = {
    body: req.body,
    attachments: {},
    filenames: {}
  }

  for (const [hash, file] of Object.entries(req.attachedFilesByHash)) {
    response.attachments[hash] = fs.readFileSync(file.path).toString('utf-8')
  }

  for (const [name, file] of Object.entries(req.attachedFilesByName)) {
    response.filenames[name] = fs.readFileSync(file.path).toString('utf-8')
  }

  res.send(response)
})

describe('utility/multipart-attachments', function () {
  it('decodes body as part of form-data', function (done) {
    chai.request(app)
      .post('/test')
      .attach('body', Buffer.from(JSON.stringify(testBody)), { contentType: 'application/json', filename: 'woo.json' })
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
      .attach('attachment', Buffer.from(attach2), { contentType: 'application/zip', filename: 'lovely-dinner-set.zip' })
      .end((err, res) => {
        if (err) return done(err)

        chai.assert.deepEqual(res.body.body, testBody, 'body should roundtrip correctly')

        chai.assert.deepEqual(res.body.filenames, {
          'clip.mp4': attach1,
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
