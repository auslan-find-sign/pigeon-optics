/**
 * CBOR codec, implementing custom tagged type for attachments
 */
const cbor = require('borc')
const objectHash = require('object-hash')
const { Attachment, AttachmentReference } = require('./attachment')
const serverTools = require('../server-tools')
const ui = require('../ui')
const standardPage = require('../views/standard-page')

module.exports.cbor = {
  /**
   * Decodes first item in buffer using CBOR, unpacking any attachments included in the cbor too
   * @param {Buffer} buffer - buffer containing cbor which optionally uses tag 27 object representation to include Attachment and AttachmentReference objects
   * @returns {any} - returns decoded object
   */
  decode (inputBuffer) {
    const decoder = new cbor.Decoder({
      size: inputBuffer.length,
      tags: {
        27: ([type, ...args]) => {
          if (type === 'dataset/Attachment') {
            return new Attachment(...args)
          } else if (type === 'dataset/AttachmentReference') {
            return new AttachmentReference(...args)
          }
        }
      }
    })

    return decoder.decodeFirst(inputBuffer)
  },

  /**
   * Encodes a CBOR encodable object, with support for this application's Attachment and AttachmentReference objects
   * @param {any} data - arbitrary object to encode
   * @returns {Buffer} - cbor buffer
   */
  encode (data) {
    return cbor.encode(data)
  }
}

module.exports.json = {
  /**
   * Decodes first item in buffer using JSON, unpacking any attachments included in the cbor too
   * @param {string} jsonString - string containing json which optionally includes files as Attachments or AttachmentReferences using duck encoding
   * @returns {any} - returns decoded object
   */
  decode (jsonString) {
    const reviver = (key, value) => {
      if (typeof value === 'object') {
        if (value.class === 'Attachment') {
          return new Attachment(Buffer.from(value.data, 'base64'), value.mimeType)
        } else if (value.class === 'AttachmentReference') {
          return new AttachmentReference(value.hash, value.mimeType)
        } else if (typeof value.bufferBase64 === 'string') {
          return Buffer.from(value.bufferBase64, 'base64')
        }
      }
      return value
    }

    return JSON.parse(jsonString, reviver)
  },

  /**
   * Encodes a JSON encodable object, with support for this application's Attachment and AttachmentReference objects
   * @param {any} data - arbitrary object to encode
   * @param {Number} spaces - how many spaces of indent to use, defaults 0 for no whitespace
   * @returns {string} - json string containing object with attachments suitably encoded
   */
  encode (object, spaces = 0) {
    const replacer = (key, value) => {
      if (value instanceof AttachmentReference) {
        if (value.data) {
          return { class: value.constructor.name, hash: value.hash.toString('hex'), mimeType: value.mimeType, data: value.data.toString('base64') }
        } else {
          return { class: value.constructor.name, hash: value.hash.toString('hex'), mimeType: value.mimeType }
        }
      } else if (Buffer.isBuffer(value)) {
        return { bufferBase64: value.toString('base64') }
      } else {
        return value
      }
    }

    return JSON.stringify(object, replacer, spaces)
  }
}

/**
 * uses object-hash npm package to hash a complex object, like those stored in datasets or viewports
 * @param {any} object - input object to hash, maybe containing attachments
 * @returns {Buffer} - sha256 hash (32 bytes) in a nodejs Buffer
 * */
module.exports.objectHash = (object) => {
  return objectHash(object, {
    algorithm: 'sha256',
    encoding: 'buffer',
    replacer: value => {
      if (value instanceof AttachmentReference) {
        // don't bother trying to hash data, and treat Attachment and AttachmentReference as equivilent since the real data hasn't changed
        return ['datasets/Attachment', value.mimeType, value.hash]
      }
      return value
    }
  })
}

/**
 * Respond to an expressjs web request, with an object encoded as JSON, CBOR, or a stylised webpage according to Accepts header
 * @param {Request} req - expressjs http request object
 * @param {Response} res - expressjs http response object
 * @param {*} object - object to send back as JSON, CBOR, or a stylised webpage
 */
module.exports.respond = (req, res, object) => {
  const bestMatch = req.accepts(['application/cbor', 'application/json', 'text/html'])
  if (bestMatch === 'application/cbor') {
    res.type(bestMatch).send(module.exports.cbor.encode(object))
  } else if (bestMatch === 'application/json') {
    res.type(bestMatch).send(module.exports.json.encode(object))
  } else {
    serverTools.sendWebpage(req, res, {
      title: 'API Object Response',
      contents: standardPage(req, [
        ui.heading({ contents: 'API Object Response:' }),
        ui.sourceCode({ contents: module.exports.json.encode(object, 2) })
      ])
    })
  }
}
