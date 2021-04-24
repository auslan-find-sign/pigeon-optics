module.exports = function isJsonML (doc) {
  return doc && typeof doc === 'object' && !Array.isArray(doc) && doc.JsonML
}
