// convert JsonML element array to the most verbose [tag-name, { attributes-list }, ...children] form
module.exports = function expandElement (element) {
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
