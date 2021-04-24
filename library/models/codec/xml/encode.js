const arbitraryNS = 'pigeon-optics:arbitrary'
const expandElement = require('./expand-element')
const buildXML = require('./build-xml')
const arbitraryObjectToJsonML = require('./arbitrary-to-jsonml')

module.exports = function encode (obj) {
  if (obj && typeof obj === 'object' && !Array.isArray(obj) && ('JsonML' in obj) && Array.isArray(obj.JsonML)) {
    return [...buildXML(obj)].join('')
  } else {
    const arbitrary = expandElement(arbitraryObjectToJsonML(obj))
    arbitrary[1].xmlns = arbitraryNS
    return [...buildXML(arbitrary)].join('')
  }
}
