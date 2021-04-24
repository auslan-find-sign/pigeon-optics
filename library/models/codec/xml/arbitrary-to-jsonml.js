const expandElement = require('./expand-element')

// converts arbitrary objects in to something that can serialize as xml, to allow interop with other tools
module.exports = function arbitraryObjectToJsonML (obj) {
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
    return ['array', ...[...obj].map(v => arbitraryObjectToJsonML(v))]
  } else if (typeof obj === 'object') {
    return ['object', ...Object.entries(obj).map(([prop, value]) => {
      const enc = expandElement(arbitraryObjectToJsonML(value))
      enc[1].name = prop
      return enc
    })]
  } else {
    throw new Error('Unsupported type: ' + JSON.stringify(obj))
  }
}
