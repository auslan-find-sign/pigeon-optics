const parse5 = require('parse5')
const domToJsonML = require('./dom-to-jsonml')

module.exports = function decode (string) {
  const document = parse5.parse(string.toString('utf-8'))
  return domToJsonML(document)
}
