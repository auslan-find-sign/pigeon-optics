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
