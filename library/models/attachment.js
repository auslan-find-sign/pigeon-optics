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
    return `${defaults.url}/attachments/${this.toString()}?type=${encodeURIComponent(this.mimeType)}`
  }

  // internal, handles cbor encoding
  encodeCBOR (gen) {
    return gen.pushAny(new cbor.Tagged(27, ['pigeon-optics/AttachmentReference', this.hash, this.mimeType]))
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
    return gen.pushAny(new cbor.Tagged(27, ['pigeon-optics/Attachment', this.data, this.mimeType]))
  }

  /**
   * Returns a Data URI containing the embedded resource
   * @returns {string}
   */
  toURL () {
    return `data:${this.mimeType};base64,${this.data.toString('base64')}`
  }
}

// crawls a structure of arrays and objects to find all attachments referenced
function listReferences (input) {
  if (Array.isArray(input)) {
    return input.flatMap(x => listReferences(x))
  } else if (typeof input === 'object') {
    if (input.constructor === AttachmentReference) {
      return [input]
    } else if (typeof input.values === 'function') {
      return input.values().flatMap(x => listReferences(x))
    } else if (input.constructor === Object) {
      return Object.values(input).flatMap(x => listReferences(x))
    }
  }
  return []
}

module.exports.AttachmentReference = AttachmentReference
module.exports.Attachment = Attachment
module.exports.listReferences = listReferences
