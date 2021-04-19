const streams = require('stream')
const onml = require('onml')

Object.assign(exports, {
  handles: ['application/xml', 'text/xml', 'application/rdf+xml', 'application/rss+xml', 'application/atom+xml', 'text/xml'],
  extensions: ['xml', 'rss', 'atom'],

  encode (obj) {
    if (obj && typeof obj === 'object' && ('JsonML' in obj) && Object.keys(obj).length) {
      return onml.stringify(obj.JsonML)
    } else {
      return this.encode({ JsonML: this.arbitraryObjectToJsonML(obj) })
    }
  },

  // converts arbitrary objects in to something that can serialize as xml, to allow interop with other tools
  arbitraryObjectToJsonML (obj) {
    if (obj === null) {
      return ['null', {}]
    } else if (obj === undefined) {
      return ['undefined', {}]
    } else if (typeof obj === 'string') {
      return ['string', {}, `${obj}`]
    } else if (typeof obj === 'number') {
      return ['number', {}, JSON.stringify(obj)]
    } else if (obj === true || obj === false) {
      return [JSON.stringify(obj), {}]
    } else if (Buffer.isBuffer(obj)) {
      return ['buffer', { encoding: 'base64' }, obj.toString('base64')]
    } else if (obj && Symbol.iterator in obj) {
      return ['array', {}, ...[...obj].map(this.arbitraryObjectToJsonML)]
    } else if (typeof obj === 'object') {
      return ['object', {}, ...Object.entries(obj).map(([prop, value]) => {
        const encoded = this.arbitraryObjectToJsonML(value)
        encoded[1].name = prop
        return encoded
      })]
    } else {
      throw new Error('Unsupported type: ' + JSON.stringify(obj))
    }
  },

  decode (input) {
    if (Buffer.isBuffer(input)) input = input.toString('utf-8')
    return { JsonML: onml.parse(input) }
  },

  encoder () {
    let first = true

    return new streams.Transform({
      writableObjectMode: true,
      transform: (chunk, encoding, callback) => {
        try {
          const xmlString = this.encode(chunk)
          if (first) {
            callback(null, Buffer.from(`<array>\n${xmlString}\n`, 'utf-8'))
            first = false
          } else {
            callback(null, Buffer.from(`${xmlString}\n`, 'utf-8'))
          }
        } catch (err) {
          callback(err)
        }
      },
      flush (callback) {
        callback(null, Buffer.from('</array>\n', 'utf-8'))
      }
    })
  }
})
