/* eslint-disable no-unused-expressions */
const crypto = require('crypto')
const { expect } = require('chai')
const createMissingAttachmentsError = require('../library/utility/missing-attachments-error')

function randomHashURL (type = 'application/octet-stream') {
  return `hash://sha256/${crypto.randomBytes(32).toString('hex')}?type=${encodeURIComponent(type)}`
}

describe('utility/missing-attachments-error()', function () {
  it('creates an error with the headers property', function () {
    const hash1 = randomHashURL()
    const hash2 = randomHashURL('text/plain')
    const err = createMissingAttachmentsError([hash1, hash2])
    expect(err.headers).is.an('object').and.has.property('X-Pigeon-Optics-Resend-With-Attachments')

    const parsed = JSON.parse(`[${err.headers['X-Pigeon-Optics-Resend-With-Attachments']}]`)
    expect(parsed).is.an('array')
    expect(parsed.every(val => typeof val === 'string')).is.ok
    expect(parsed).to.deep.equal([hash1, hash2])
  })
})
