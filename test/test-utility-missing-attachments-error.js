const crypto = require('crypto')
const chai = require('chai')
const assert = chai.assert
const createMissingAttachmentsError = require('../library/utility/missing-attachments-error')

function randomHashURL (type = 'application/octet-stream') {
  return `hash://sha256/${crypto.randomBytes(32).toString('hex')}?type=${encodeURIComponent(type)}`
}

describe('utility/missing-attachments-error()', function () {
  it('creates an error with the headers property', function () {
    const hash1 = randomHashURL()
    const hash2 = randomHashURL('text/plain')
    const err = createMissingAttachmentsError([hash1, hash2])
    assert(err.headers && typeof err.headers === 'object', 'headers property must be an object')
    assert.isTrue('X-Pigeon-Optics-Resend-With-Attachments' in err.headers, 'must have X-Pigeon-Optics-Resend-With-Attachments header')
    const parsed = JSON.parse(`[${err.headers['X-Pigeon-Optics-Resend-With-Attachments']}]`)
    assert(Array.isArray(parsed), 'parsed value must be a javascript Array')
    assert(parsed.every(val => typeof val === 'string'), 'All values of the X-Pigeon-Optics-Resend-With-Attachments header must be strings')
    assert.deepStrictEqual(parsed.sort(), [
      hash1,
      hash2
    ].sort(), 'X-Pigeon-Optics-Resend-With-Attachments header must parse and must contain the list of hash urls specified')
  })
})
