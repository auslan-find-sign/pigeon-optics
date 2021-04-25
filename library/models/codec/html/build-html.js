const assert = require('assert')
const selfClosingTags = new Set(require('html-tags/void'))
const esc = require('./escape')
const countChars = require('../xml/count-chars')

module.exports = function * buildHTML (element) {
  if (Array.isArray(element)) {
    // tag
    const [tag, ...more] = element
    const attribs = more[0] && typeof more[0] === 'object' && !Array.isArray(more[0]) ? more.shift() : {}
    assert(typeof tag === 'string', 'tag name must be a string')

    if (tag === '#comment') {
      // comment
      yield `<!--${more.join('')}-->`
    } else if (tag === '#document-fragment') {
      // fragment, collection of multiple child tags
      for (const child of more) yield * buildHTML(child)
    } else if (tag === '#document') {
      yield '<!DOCTYPE html>\n'
      for (const child of more) yield * buildHTML(child)
    } else if (tag === '#cdata-section') {
      yield '<![CDATA['
      for (const child of more) yield * buildHTML(child)
      yield ']]>'
    } else if (tag.startsWith('?')) {
      // processing instruction, like ?xml or ?xml-stylesheet
      yield `<${tag}${[...buildHTML(attribs)].join('')}?>`
    } else {
      const isSelfClosing = selfClosingTags.has(tag.toLowerCase())
      assert(tag.match(/^[a-zA-Z0-9]+$/), 'tag name must be alphanumeric')

      if (isSelfClosing) {
        yield `<${tag}${[...buildHTML(attribs)].join('')}>`
        if (more.length > 0) throw new Error(`<${tag}> html element cannot contain child nodes`)
      } else {
        yield `<${tag}${[...buildHTML(attribs)].join('')}>`
        for (const child of more) {
          yield * buildHTML(child)
        }
        yield `</${tag}>`
      }
    }
  } else if (typeof element === 'object') {
    // attributes
    for (const [name, value] of Object.entries(element)) {
      assert(name.match(/^[^ "'>/=\0\cA-\cZ\u007F-\u009F]+$/), 'invalid attribute name')

      if (value === true) {
        yield ` ${name}`
      } else if (value === false) {
        continue
      } else if (typeof value === 'string') {
        if (value.match(/^[^ "'`=<>]+$/mg)) {
          // no quotes needed
          yield ` ${name}=${esc(value, '"\'&<>')}`
        } else {
          const singleQuoteCount = countChars(value, "'")
          const doubleQuoteCount = countChars(value, '"')
          if (doubleQuoteCount > singleQuoteCount) {
            yield ` ${name}='${esc(value, "<&'")}'`
          } else {
            yield ` ${name}="${esc(value, '<&"')}"`
          }
        }
      }
    }
  } else if (typeof element === 'string') {
    // text node
    yield esc(element, '&<')
  } else {
    throw new Error('Unsupported content ' + JSON.stringify(element))
  }
}
