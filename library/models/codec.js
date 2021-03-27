/**
 * CBOR codec, implementing custom tagged type for attachments
 */
const cbor = require('cbor')
const json5 = require('json5')
const objectHash = require('object-hash')
const { Attachment, AttachmentReference } = require('./attachment')
const Vibe = require('../vibe/rich-builder')
const layout = require('../views/layout')

module.exports.cbor = {
  decoderOpts: {},

  encoderOpts: { highWaterMark: 25000000 },

  /**
   * Decodes first item in buffer using CBOR, unpacking any attachments included in the cbor too
   * @param {Buffer} buffer - buffer containing cbor which optionally uses tag 27 object representation to include Attachment and AttachmentReference objects
   * @returns {any} - returns decoded object
   */
  decode (inputBuffer) {
    return cbor.decodeFirstSync(inputBuffer, exports.cbor.decoderOpts)
  },

  getDecodeStream () {
    return new cbor.Decoder(exports.cbor.decoderOpts)
  },

  getEncoderStream () {
    return new cbor.Encoder(exports.cbor.encoderOpts)
  },

  /**
   * Encodes a CBOR encodable object, with support for this application's Attachment and AttachmentReference objects
   * @param {any} data - arbitrary object to encode
   * @returns {Buffer} - cbor buffer
   */
  encode (data) {
    return cbor.encodeOne(data, exports.cbor.encoderOpts)
  }
}

module.exports.json = {
  /**
   * Decodes first item in buffer using JSON, unpacking any attachments included in the cbor too
   * @param {string} jsonString - string containing json which optionally includes NodeJS stringified Buffers
   * @returns {any} - returns decoded object
   */
  decode (jsonString) {
    const reviver = (key, value) => {
      if (value && typeof value === 'object' && value.type === 'Buffer' && Array.isArray(value.data)) {
        return Buffer.from(value)
      }
      return value
    }

    try {
      if (Buffer.isBuffer(jsonString)) jsonString = jsonString.toString('utf-8')
      return JSON.parse(jsonString, reviver)
    } catch (err) {
      return json5.parse(jsonString, reviver)
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
  }
}

const ptr = require('path-to-regexp')
const datasetPath = '/:source(lenses|datasets|meta)/:user\\::name'
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
  const bestMatch = req.accepts(['text/html', 'application/cbor', 'application/json'])

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
      if (req.query.encoding !== 'json-lines') res.write('[\n')
      let first = true
      for await (const entry of object) {
        if (!first && req.query.encoding !== 'json-lines') res.write(',\n')
        res.write('\t' + module.exports.json.encode(entry))
        first = false
      }
      if (req.query.encoding !== 'json-lines') res.write('\n]\n')
      res.write(null)
    } else {
      await new Promise((resolve, reject) => {
        Vibe.docStream('API Object Response Stream', layout(req, async v => {
          await v.panel(async v => {
            v.heading('API Object Response Stream:')

            for await (const entry of object) {
              v.sourceCode(module.exports.json.encode(entry, 2))
            }
          })
        })).pipe(res).on('close', () => resolve()).on('error', e => reject(e))
      })
    }
  } else {
    if (bestMatch === 'application/cbor') {
      res.type(bestMatch).send(module.exports.cbor.encode(object))
    } else if (bestMatch === 'application/json') {
      res.type(bestMatch).send(module.exports.json.encode(object))
    } else {
      await new Promise((resolve, reject) => {
        Vibe.docStream('API Object Response', layout(req, v => {
          v.panel(v => {
            v.heading('API Object Response:')
            v.sourceCode(module.exports.json.encode(object, 2))
          })
        })).pipe(res).on('close', () => resolve()).on('error', e => reject(e))
      })
    }
  }
}
