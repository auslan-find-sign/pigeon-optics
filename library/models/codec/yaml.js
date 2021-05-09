const yaml = require('yaml')
const streams = require('stream')
const json = require('./json')
const createHttpError = require('http-errors')

Object.assign(exports, {
  handles: ['application/yaml', 'text/yaml', 'application/x-yaml', 'text/x-yaml'],
  extensions: ['yaml', 'yml'],

  decode (yamlString) {
    if (Buffer.isBuffer(yamlString)) yamlString = yamlString.toString('utf-8')
    return yaml.parse(yamlString, json.reviver)
  },

  encode (object) {
    return yaml.stringify(object, json.replacer)
  },

  /**
   * Create a transform stream which decodes a stream of yaml documents into objects
   * @param {object} [options]
   * @param {number} [options.maxSize] - max size in bytes of each line - otherwise throws a http 413 Payload size error
   * @returns {streams.Transform}
   */
  decoder ({ maxSize = 32000000 } = {}) {
    let buffer = Buffer.from([])
    const self = this

    return new streams.Transform({
      readableObjectMode: true,
      transform (chunk, encoding, callback) {
        if (buffer.length + chunk.length > maxSize * 2) {
          return callback(createHttpError(413, `Each yaml document cannot be larger than ${maxSize} bytes`))
        }
        buffer = Buffer.concat([buffer, chunk])
        while (true) {
          const offset = buffer.indexOf('\n...\n')
          if (offset === -1) {
            return callback(null)
          } else {
            // slice off the first document from the buffer
            const lineSlice = buffer.slice(0, offset + 1)
            if (lineSlice.length > maxSize) return callback(createHttpError(413, `Each yaml document cannot be larger than ${maxSize} bytes`))
            const docText = lineSlice.toString('utf-8')
            buffer = buffer.slice(offset + 5)
            try {
              this.push(self.decode(docText))
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
      transform: (chunk, encoding, callback) => {
        try { callback(null, `${this.encode(chunk)}...\n`) } catch (err) { callback(err) }
      }
    })
  },

  // speciality encoder for building xml flat file exports
  entriesEncoder () {
    return new streams.Transform({
      writableObjectMode: true,
      transform: (chunk, encoding, callback) => {
        const block = {
          id: chunk.id,
          version: chunk.version,
          hash: chunk.hash.toString('hex'),
          data: chunk.data
        }
        try { callback(null, `${this.encode(block)}...\n`) } catch (err) { callback(err) }
      }
    })
  }
})
