const cbor = require('borc')
const crypto = require('crypto')
const defaults = require('../../package.json').defaults

/**
 * Attachment is a little tagged thing to represent a file that is attached to an object in the dataset store
 */
class AttachmentReference {
  constructor (hash, mimeType = 'application/octet-stream') {
    this.version = 1
    this.mimeType = mimeType
    if (typeof hash === 'string') {
      this.hash = Buffer.from(hash, 'hex')
    } else if (Buffer.isBuffer(hash)) {
      this.hash = hash
    } else if (hash instanceof AttachmentReference) {
      this.hash = hash.hash
      this.mimeType = hash.mimeType
    } else if (hash instanceof Attachment) {
      this.hash = hash.hash
      this.mimeType = hash.mimeType
    } else {
      throw new Error('Invalid input hash type')
    }
  }

  /**
   * Returns a string hex representation of this attachment
   * @returns {string}
   */
  toString () {
    return this.hash.toString('hex')
  }

  /**
   * Returns a URL to this resource
   * @returns {string}
   */
  toURL () {
    return `${defaults.url}/attachments/${this.toString()}?type=${encodeURIComponent(this.timeType)}`
  }

  // internal, handles cbor encoding
  encodeCBOR (gen) {
    return gen.pushAny(new cbor.Tagged(27, ['dataset/AttachmentReference', this.hash, this.mimeType]))
  }
}

/**
 * like AttachmentReference, but the data is included in memory, packed in to cbor or whatever
 */
class Attachment extends AttachmentReference {
  constructor (data, mimeType = 'application/octet-stream') {
    const hasher = crypto.createHash('sha256')
    hasher.update(data)
    const hash = hasher.digest()
    super(hash, mimeType)
    this.data = data
  }

  // internal, handles cbor encoding
  encodeCBOR (gen) {
    return gen.pushAny(new cbor.Tagged(27, ['dataset/Attachment', this.data, this.mimeType]))
  }
}

module.exports.AttachmentReference = AttachmentReference
module.exports.Attachment = Attachment
