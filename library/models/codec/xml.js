const streams = require('stream')
const onml = require('onml')
const arbitraryNS = 'pigeon-optics:arbitrary'

// convert JsonML element array to the most verbose [tag-name, { attributes-list }, ...children] form
function expandElement (element) {
  if (!Array.isArray(element)) throw new Error('element must be an array')
  if (typeof element[0] !== 'string') throw new Error('first array item must be string type tag-name')
  const tag = element[0]

  if (element.length === 1) {
    // no attributes or children
    return [tag, {}]
  } else if (element.length > 1 && (typeof element[1] === 'string' || Array.isArray(element[1]))) {
    // no attributes
    return [tag, {}, ...element.slice(1)]
  } else {
    return element
  }
}

Object.assign(exports, {
  handles: ['application/xml', 'text/xml', 'application/rdf+xml', 'application/rss+xml', 'application/atom+xml', 'text/xml', 'application/xhtml+xml'],
  extensions: ['xml', 'rss', 'atom', 'xhtml'],

  // converts arbitrary objects in to something that can serialize as xml, to allow interop with other tools
  arbitraryObjectToJsonML (obj) {
    if (obj === null) {
      return ['null']
    } else if (obj === undefined) {
      return ['undefined']
    } else if (typeof obj === 'string') {
      return ['string', `${obj}`]
    } else if (typeof obj === 'number') {
      return ['number', obj.toString()]
    } else if (obj instanceof Date) {
      return ['date', obj.toISOString()]
    } else if (obj === true || obj === false) {
      return [obj ? 'true' : 'false']
    } else if (Buffer.isBuffer(obj)) {
      return ['buffer', { encoding: 'base64' }, obj.toString('base64')]
    } else if (obj && Symbol.iterator in obj) {
      return ['array', ...[...obj].map(this.arbitraryObjectToJsonML)]
    } else if (typeof obj === 'object') {
      return ['object', ...Object.entries(obj).map(([prop, value]) => {
        const enc = expandElement(this.arbitraryObjectToJsonML(value))
        enc[1].name = prop
        return enc
      })]
    } else {
      throw new Error('Unsupported type: ' + JSON.stringify(obj))
    }
  },

  jsonMLToArbitraryObject (jsonml) {
    if (jsonml && typeof jsonml === 'object' && jsonml.JsonML) return this.jsonMLToArbitraryObject(jsonml.JsonML)
    const tag = jsonml[0]
    const hasAttributes = jsonml[1] && typeof jsonml[1] === 'object'
    const attributes = hasAttributes ? jsonml[1] : {}
    const children = jsonml.slice(hasAttributes ? 2 : 1)
    const map = { true: true, false: false, null: null, undefined: undefined }

    if (tag in map) {
      return map[tag]
    } else if (tag === 'number') {
      return parseFloat(children.join(''))
    } else if (tag === 'date') {
      return new Date(children.join(''))
    } else if (tag === 'string') {
      return children.join('')
    } else if (tag === 'buffer') {
      return Buffer.from(children.join(''), attributes.encoding)
    } else if (tag === 'array') {
      return children.map(child => this.jsonMLToArbitraryObject(child))
    } else if (tag === 'object') {
      return Object.fromEntries(children.map(child => {
        return [child[1].name, this.jsonMLToArbitraryObject(child)]
      }))
    }
  },

  encode (obj) {
    if (obj && typeof obj === 'object' && ('JsonML' in obj)) {
      return onml.stringify(obj.JsonML)
    } else {
      const arbitrary = expandElement(this.arbitraryObjectToJsonML(obj))
      arbitrary[1].xmlns = arbitraryNS
      return onml.stringify(arbitrary)
    }
  },

  decode (input) {
    if (Buffer.isBuffer(input)) input = input.toString('utf-8')
    const parsed = onml.parse(input)
    if (Array.isArray(parsed) && parsed[1] && typeof parsed[1] === 'object' && parsed[1].xmlns === arbitraryNS) {
      return this.jsonMLToArbitraryObject(parsed)
    } else {
      return { JsonML: parsed }
    }
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
