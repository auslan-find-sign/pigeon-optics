/**
 * CBOR codec, implementing custom tagged type for attachments
 */
const cbor = require('cbor')
const json5 = require('json5')
const yaml = require('yaml')
const msgpack = require('msgpack5')
const objectHash = require('object-hash')
const Vibe = require('../vibe/rich-builder')
const layout = require('../views/layout')
const streams = require('stream')

exports.cbor = {
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

  decoder () {
    return new cbor.Decoder(exports.cbor.decoderOpts)
  },

  encoder () {
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

exports.json = {
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
      transform (chunk, encoding, callback) {
        try {
          const json = exports.json.encode(chunk)
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
}

exports.jsonLines = {
  encode (array) {
    if (array && typeof array === 'object' && array[Symbol.iterator]) {
      const out = []
      for (const item of array) {
        out.push(exports.json.encode(item) + '\n')
      }
      return out.join('')
    } else {
      throw new Error('input must be an array or an iterable')
    }
  },

  decode (input) {
    return input.split('\n').map(x => x.trim()).filter(x => x.length > 0).map(x => exports.json.decode(x))
  },

  // decodes a readable stream of json-lines data in to an object-mode stream
  decoder () {
    /** @type {Buffer} */
    let buff = Buffer.from([])
    return new streams.Transform({
      readableObjectMode: true,
      transform (chunk, encoding, callback) {
        buff = Buffer.concat([buff, chunk])

        while (true) {
          const nlIndex = buff.indexOf('\n')
          if (nlIndex >= 0) {
            const jsonString = buff.slice(0, nlIndex).toString('utf-8')
            buff = buff.slice(nlIndex + 1)
            try {
              this.push(exports.json.decode(jsonString))
            } catch (err) {
              callback(err)
            }
          } else {
            return callback(null)
          }
        }
      }
    })
  },

  // encodes a readable object stream in to json-lines format
  encoder () {
    return new streams.Transform({
      writableObjectMode: true,
      transform (chunk, encoding, callback) {
        try {
          callback(null, Buffer.from(`${exports.json.encode(chunk)}\n`, 'utf-8'))
        } catch (err) {
          callback(err)
        }
      }
    })
  }
}

exports.yaml = {
  decode (yamlString) {
    if (Buffer.isBuffer(yamlString)) yamlString = yamlString.toString('utf-8')
    return yaml.parse(yamlString, exports.json.reviver)
  },

  encode (object) {
    return yaml.stringify(object)
  },

  // a decoder stream which outputs objects for each document
  decoder () {
    let buffer = Buffer.from([])
    return new streams.Transform({
      readableObjectMode: true,
      transform (chunk, encoding, callback) {
        buffer = Buffer.concat([buffer, chunk])
        while (true) {
          const offset = buffer.indexOf('\n...\n')
          if (offset === -1) {
            return callback(null)
          } else {
            // slice off the first document from the buffer
            const docText = buffer.slice(0, offset + 1).toString('utf-8')
            buffer = buffer.slice(offset + 5)
            try {
              this.push(exports.yaml.decode(docText))
            } catch (err) {
              return callback(err)
            }
          }
        }
      }
    })
  },

  encoder () {
    return new streams.Transform({
      writableObjectMode: true,
      transform (chunk, encoding, callback) {
        try { callback(null, `${exports.yaml.encode(chunk)}...\n`) } catch (err) { callback(err) }
      }
    })
  }
}

exports.msgpack = msgpack()

const ptr = require('path-to-regexp')
const datasetPath = '/:source(lenses|datasets|meta)/:user\\::name'
const datasetMatch = ptr.match(datasetPath)
const datasetCompile = ptr.compile(datasetPath)
const recordPath = `${datasetPath}/records/:recordID`
const recordMatch = ptr.match(recordPath)
const recordCompile = ptr.compile(recordPath)

exports.path = {
  decode (string) {
    const out = datasetMatch(string) || recordMatch(string)
    return out ? { ...out.params } : out
  },
  encode (source, user, name, recordID = undefined) {
    if (typeof source === 'object') {
      return this.encode(source.source, source.user, source.name, source.recordID)
    }

    if (typeof recordID === 'string') {
      return recordCompile({ source, user, name, recordID })
    } else {
      return datasetCompile({ source, user, name })
    }
  }
}

/**
 * uses object-hash npm package to hash a complex object, like those stored in datasets or viewports
 * @param {any} object - input object to hash, maybe containing attachments
 * @returns {Buffer} - sha256 hash (32 bytes) in a nodejs Buffer
 * */
exports.objectHash = (object) => {
  return objectHash(object, { algorithm: 'sha256', encoding: 'buffer' })
}

/**
 * Respond to an expressjs web request, with an object encoded as JSON, CBOR, or a stylised webpage according to Accepts header
 * @param {Request} req - expressjs http request object
 * @param {Response} res - expressjs http response object
 * @param {*} object - object to send back as JSON, CBOR, or a stylised webpage
 */
exports.respond = async function respond (req, res, object) {
  const supportedTypes = ['text/html', ...Object.values(respond.handlers).flat()]
  const bestMatch = req.accepts(supportedTypes)
  const encoderName = Object.entries(respond.handlers).find(([name, list]) => list.includes(bestMatch))[0]
  const handler = exports[encoderName]

  if (object[Symbol.asyncIterator]) { // AsyncIterators will stream out as an array or some kind of list
    if (handler) {
      res.type(bestMatch)

      const inputStream = object instanceof streams.Readable ? object : streams.Readable.from(object)
      const encoder = inputStream.pipe(handler.encoder())
      encoder.pipe(res)
      return new Promise((resolve, reject) => {
        encoder.on('end', resolve)
        encoder.on('error', reject)
      })
    } else {
      await new Promise((resolve, reject) => {
        Vibe.docStream('API Object Response Stream', layout(req, async v => {
          await v.panel(async v => {
            v.heading('API Object Response Stream:')

            for await (const entry of object) {
              v.sourceCode(module.exports.json.print(entry, 2))
            }
          })
        })).pipe(res).on('close', () => resolve()).on('error', e => reject(e))
      })
    }
  } else {
    if (handler) {
      res.type(bestMatch).send(handler.encode(object))
    } else {
      return new Promise((resolve, reject) => {
        Vibe.docStream('API Object Response', layout(req, v => {
          v.panel(v => {
            v.heading('API Object Response:')
            v.sourceCode(exports.json.print(object, 2))
          })
        })).pipe(res).on('close', () => resolve()).on('error', e => reject(e))
      })
    }
  }
}

exports.respond.handlers = {
  json: ['application/json'],
  yaml: ['application/yaml', 'application/x-yaml', 'text/yaml', 'text/x-yaml'],
  jsonLines: ['ndjson', 'jsonlines'].flatMap(x => [`text/${x}`, `text/x-${x}`, `application/${x}`, `application/x-${x}`]),
  msgpack: ['application/msgpack', 'application/x-msgpack'],
  cbor: ['application/cbor']
}
