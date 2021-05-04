const createHttpError = require('http-errors')
const streams = require('stream')
const json = require('./json')

Object.assign(exports, {
  handles: ['ndjson', 'jsonlines'].flatMap(x => [`application/${x}`, `text/${x}`, `application/x-${x}`, `text/x-${x}`]),
  extensions: ['jsonl'],

  encode (object) {
    if (object && typeof object === 'object') {
      if (object[Symbol.iterator]) {
        const out = []
        for (const item of object) {
          out.push(json.encode(item) + '\n')
        }
        return out.join('')
      } else {
        return this.encode(Object.entries(object))
      }
    } else {
      return json.encode(object) + '\n'
    }
  },

  decode (input) {
    if (Buffer.isBuffer(input)) input = input.toString('utf-8')
    return input.split('\n').map(x => x.trim()).filter(x => x.length > 0).map(x => json.decode(x))
  },

  /**
   * Create a transform stream which decodes jsonlines into objects
   * @param {object} [options]
   * @param {number} [options.maxSize] - max size in bytes of each line - otherwise throws a http 413 Payload size error
   * @returns {streams.Transform}
   */
  decoder ({ maxSize = 32000000 } = {}) {
    /** @type {Buffer} */
    let buff = Buffer.from([])
    return new streams.Transform({
      readableObjectMode: true,
      transform (chunk, encoding, callback) {
        if (buff.length + chunk.length > maxSize * 2) {
          return callback(createHttpError(413, `JSON Lines parsing is limited to ${maxSize} per line`))
        }
        buff = Buffer.concat([buff, chunk])

        while (true) {
          const nlIndex = buff.indexOf('\n')
          if (nlIndex >= 0) {
            const lineSlice = buff.slice(0, nlIndex)
            if (lineSlice.length > maxSize) return callback(createHttpError(413, `JSON Lines parsing is limited to ${maxSize} per line`))
            const jsonString = lineSlice.toString('utf-8')
            buff = buff.slice(nlIndex + 1)
            try {
              this.push(json.decode(jsonString))
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
          callback(null, Buffer.from(`${json.encode(chunk)}\n`, 'utf-8'))
        } catch (err) {
          callback(err)
        }
      }
    })
  }
})
