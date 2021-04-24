const isJsonML = require('./is-jsonml')

module.exports = function jsonMLToArbitraryObject (jsonml) {
  if (isJsonML(jsonml)) jsonml = jsonml.JsonML
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
    return children.map(child => jsonMLToArbitraryObject(child))
  } else if (tag === 'object') {
    return Object.fromEntries(children.map(child => {
      return [child[1].name, jsonMLToArbitraryObject(child)]
    }))
  }
}
