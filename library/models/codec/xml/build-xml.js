const assert = require('assert')
const countChars = require('./count-chars')
const esc = require('./escape')

module.exports = function * buildXML (element) {
  if (Array.isArray(element)) {
    // tag
    const [tag, ...more] = element
    const attribs = more[0] && typeof more[0] === 'object' && !Array.isArray(more[0]) ? more.shift() : {}
    assert(typeof tag === 'string', 'tag name must be a string')
    assert(tag.length > 0, 'tag must not be an empty string')

    if (tag === '#comment') {
      // comment
      yield `<!-- ${more.filter(x => typeof x === 'string').join('').replace('--', '-')} -->`
    } else if (tag === '#document-fragment' || tag === '#document') {
      // fragment, collection of multiple child tags
      for (const child of more) yield * buildXML(child)
    } else if (tag === '#cdata-section') {
      yield `<![CDATA[${more.join('')}]]>`
    } else if (tag.startsWith('?')) {
      // processing instruction, like ?xml or ?xml-stylesheet
      yield `<${tag}${[...buildXML(attribs)].join('')}?>`
    } else {
      if (more.length > 0) {
        yield `<${tag}${[...buildXML(attribs)].join('')}>`
        for (const child of more) {
          yield * buildXML(child)
        }
        yield `</${tag}>`
      } else {
        yield `<${tag}${[...buildXML(attribs)].join('')}/>`
      }
    }
  } else if (typeof element === 'object' && 'JsonML' in element) {
    // document root
    yield * buildXML(element.JsonML)
  } else if (typeof element === 'object') {
    // attributes
    for (const [name, value] of Object.entries(element)) {
      assert(typeof name === 'string')
      assert(name.length > 0)
      assert(typeof value === 'string')

      const singleQuoteCount = countChars(value, "'")
      const doubleQuoteCount = countChars(value, '"')
      if (doubleQuoteCount > singleQuoteCount) {
        yield ` ${name}='${esc(value, "<&'")}'`
      } else {
        yield ` ${name}="${esc(value, '<&"')}"`
      }
    }
  } else if (typeof element === 'string') {
    // text node
    yield esc(element, '&<')
  } else {
    assert.fail('Unsupported content ' + JSON.stringify(element))
  }
}
