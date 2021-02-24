/**
 * CBOR codec, implementing custom tagged type for attachments
 */
const cbor = require('borc')
const objectHash = require('object-hash')
const { Attachment, AttachmentReference } = require('./attachment')
const Vibe = require('../vibe/rich-builder')
const layout = require('../views/layout')

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
          if (type === 'pigeon-optics/Attachment') {
            return new Attachment(...args)
          } else if (type === 'pigeon-optics/AttachmentReference') {
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
          return { class: value.constructor.name, hash: value.hash.toString('hex').toLowerCase(), mimeType: value.mimeType, data: value.data.toString('base64') }
        } else {
          return { class: value.constructor.name, hash: value.hash.toString('hex').toLowerCase(), mimeType: value.mimeType }
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

// cloneable/transferrable encoding, inputs and outputs objects, but encodes
// Attachments and Buffers in to something cloneable. Unlike the JSON codec this
// doesn't depend on having a base64 codec available, and doesn't aim to have compact
// or efficient or compressable output when serialized to JSON
// It's just used internally for passing data between virtual machine boundaries
module.exports.cloneable = {
  decode (object) {
    if (Array.isArray(object)) {
      return object.map(entry => this.decode(entry))
    } else if (typeof object === 'object') {
      if ('_bufferArrayBytes' in object) {
        return Buffer.from(object._bufferArrayBytes)
      } else if (object._class === 'Attachment') {
        return new Attachment(Buffer.from(object._bytes), object._mimeType)
      } else if (object._class === 'AttachmentReference') {
        return new AttachmentReference(Buffer.from(object._hashBytes), object._mimeType)
      }

      return Object.fromEntries(Object.entries(object).map(([key, value]) => {
        return [key, this.decode(value)]
      }))
    } else {
      return object
    }
  },

  encode (object) {
    if (Array.isArray(object)) {
      return object.map(entry => this.encode(entry))
    } else if (Buffer.isBuffer(object)) {
      return { _bufferArrayBytes: [...object] }
    } else if (object instanceof Attachment) {
      return {
        _class: 'Attachment',
        _bytes: [...object.data],
        _mimeType: object.mimeType,
        _hash: [...object.hash]
      }
    } else if (object instanceof AttachmentReference) {
      return {
        _class: 'AttachmentReference',
        _mimeType: object.mimeType,
        _hash: [...object.hash]
      }
    } else if (typeof object === 'object') {
      return Object.fromEntries(Object.entries(object).map(([key, value]) => {
        return [key, this.decode(value)]
      }))
    }

    return object
  }
}

const ptr = require('path-to-regexp')
const datasetPath = '/:source(lenses|datasets)/:user\\::name'
const datasetMatch = ptr.match(datasetPath)
const datasetCompile = ptr.compile(datasetPath)
const recordPath = `${datasetPath}/records/:recordID`
const recordMatch = ptr.match(recordPath)
const recordCompile = ptr.compile(recordPath)

module.exports.path = {
  decode (string) {
    const out = datasetMatch(string) || recordMatch(string)
    return out ? out.params : out
  },
  encode (...args) {
    if (args.length === 1) {
      return args.recordID ? recordCompile(args[0]) : datasetCompile(args[0])
    } else {
      const [source, user, name, recordID] = args
      return recordID ? recordCompile({ source, user, name, recordID }) : datasetCompile({ source, user, name })
    }
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
module.exports.respond = async (req, res, object) => {
  const bestMatch = req.accepts(['application/cbor', 'application/json', 'text/html'])

  if (object[Symbol.asyncIterator]) { // AsyncIterators will stream out
    if (bestMatch === 'application/cbor') {
      res.type(bestMatch)
      res.write(Buffer.from('9F', 'hex')) // CBOR indefinite length array start
      for await (const entry of object) {
        res.write(module.exports.cbor.encode(entry))
      }
      res.write(Buffer.from('FF', 'hex')) // CBOR break code
      res.write(null)
    } else if (bestMatch === 'application/json') {
      res.type(bestMatch)
      res.write('[\n')
      let first = true
      for await (const entry of object) {
        if (!first) res.write(',\n')
        res.write(module.exports.json.encode(entry))
        first = false
      }
      res.write('\n]\n')
      res.write(null)
    } else {
      Vibe.docStream('API Object Response Stream', layout(req, async v => {
        v.heading('API Object Response Stream:')
        for await (const entry of object) {
          v.sourceCode(module.exports.json.encode(entry, 2))
        }
      })).pipe(res)
    }
  } else {
    if (bestMatch === 'application/cbor') {
      res.type(bestMatch).send(module.exports.cbor.encode(object))
    } else if (bestMatch === 'application/json') {
      res.type(bestMatch).send(module.exports.json.encode(object))
    } else {
      Vibe.docStream('API Object Response', layout(req, v => {
        v.heading('API Object Response:')
        v.sourceCode(module.exports.json.encode(object, 2))
      })).pipe(res)
    }
  }
}
