const onml = require('onml')
const arbitraryNS = 'pigeon-optics:arbitrary'
const jsonMLToArbitraryObject = require('./jsonml-to-arbitrary')

module.exports = function decode (input) {
  if (Buffer.isBuffer(input)) input = input.toString('utf-8')
  const parsed = onml.parse(input)
  if (Array.isArray(parsed) && parsed[1] && typeof parsed[1] === 'object' && parsed[1].xmlns === arbitraryNS) {
    return jsonMLToArbitraryObject(parsed)
  } else {
    return { JsonML: parsed }
  }
}
