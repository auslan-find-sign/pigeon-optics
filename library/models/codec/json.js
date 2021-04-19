const json5 = require('json5')
const streams = require('stream')

Object.assign(exports, {
  handles: ['application/json', 'text/json', 'application/feed+json'],
  extensions: ['json'],

  reviver (key, value) {
    if (value && typeof value === 'object' && value.type === 'Buffer' && Array.isArray(value.data)) {
      return Buffer.from(value)
    }
    return value
  },

  /**
   * Decodes first item in buffer using JSON, unpacking any attachments included in the cbor too
   * @param {string} jsonString - string containing json which optionally includes NodeJS stringified Buffers
   * @returns {any} - returns decoded object
   */
  decode (jsonString) {
    try {
      if (Buffer.isBuffer(jsonString)) jsonString = jsonString.toString('utf-8')
      return JSON.parse(jsonString, this.reviver)
    } catch (err) {
      return json5.parse(jsonString, this.reviver)
    }
  },

  /**
   * Encodes a JSON encodable object, with support for this application's Attachment and AttachmentReference objects
   * @param {any} data - arbitrary object to encode
   * @param {Number} spaces - how many spaces of indent to use, defaults 0 for no whitespace
   * @returns {string} - json string containing object with attachments suitably encoded
   */
  encode (object, spaces = 0) {
    return JSON.stringify(object, null, spaces)
  },

  /**
   * Pretty prints an object using json5, with Attachments encoded in json format
   * @param {any} data - arbitrary object to encode
   * @param {Number} spaces - how many spaces of indent to use, defaults 0 for no whitespace
   * @returns {string} - json string containing object with attachments suitably encoded
   */
  print (object, spaces = 2) {
    return json5.stringify(object, null, spaces)
  },

  /**
   * Create a transform stream, which takes objects, and encodes them in to a streaming json array
   * @returns {streams.Transform}
   */
  encoder () {
    let first = true
    return new streams.Transform({
      writableObjectMode: true,
      transform: (chunk, encoding, callback) => {
        try {
          const json = this.encode(chunk)
          if (first) callback(null, Buffer.from(`[\n  ${json}`, 'utf-8'))
          else callback(null, Buffer.from(`,\n  ${json}`, 'utf-8'))
          first = false
        } catch (err) {
          callback(err)
        }
      },
      flush (callback) {
        this.push('\n]\n')
        callback(null)
      }
    })
  }
})
