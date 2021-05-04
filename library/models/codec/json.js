const json5 = require('json5')
const streams = require('stream')
const streamJson = require('stream-json')
const { chain } = require('stream-chain')
const createHttpError = require('http-errors')

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
   * nullSymbol is a placeholder to represent null as a value in json streams with encoder/decoder functions
   */
  nullSymbol: Symbol('JSON Null Token'),

  /**
   * Create a transform stream, which takes in objects, and encodes them in to a streaming json array
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
  },

  /**
   * Create a transform stream which decodes a JSON in to a stream of objects, the root must be an Array or an Object
   * Root arrays will result in an array, root objects will result in entries-like outputs [key, value] as each root
   * property is parsed
   * @param {object} [options]
   * @param {number} [options.maxSize] - max size in bytes of each line - otherwise throws a http 413 Payload size error
   * @returns {streams.Transform}
   */
  decoder ({ maxSize = 32000000 } = {}) {
    let size = 0
    let started = false
    const stack = []
    const keyStack = []

    return chain([
      function checkSize (input) {
        if (size + input.length > maxSize + (1024 * 64)) {
          throw createHttpError(413, `Each ${started} value must be no larger than ${maxSize} bytes`)
        }
        size += input.length
        return input
      },
      streamJson.parser({ packValues: true, streamValues: false }),
      function structurize ({ name, value }) {
        size = 0

        const append = (value) => {
          if (stack.length > 0) {
            if (Array.isArray(stack[0])) {
              stack[0].push(value)
            } else {
              stack[0][keyStack.shift()] = value
            }
          } else {
            if (started === 'array') {
              this.push(value)
            } else {
              this.push([keyStack.shift(), value])
            }
          }
        }

        if (!started) {
          if (name === 'startArray') {
            started = 'array'
            return []
          } else if (name === 'startObject') {
            started = 'object'
            return []
          } else {
            throw createHttpError(400, 'root object must be an Array or Object')
          }
        } else {
          if (name === 'numberValue') {
            append(JSON.parse(value))
          } else if (name === 'stringValue') {
            append(value)
          } else if (name === 'trueValue') {
            append(true)
          } else if (name === 'falseValue') {
            append(false)
          } else if (name === 'nullValue') {
            append(null)
          } else if (name === 'keyValue') {
            keyStack.unshift(value)
          } else if (name === 'startObject') {
            stack.unshift({})
          } else if (name === 'endObject') {
            if (stack.length > 0) {
              let obj = stack.shift()
              if (obj.type === 'Buffer') {
                obj = Buffer.from(obj)
              }
              append(obj)
            }
          } else if (name === 'startArray') {
            stack.unshift([])
          } else if (name === 'endArray') {
            if (stack.length > 0) {
              append(stack.shift())
            }
          }
        }
      }
    ])
  }
})
