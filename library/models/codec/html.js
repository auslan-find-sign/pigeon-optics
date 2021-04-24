/**
 * HTML codec, transforms JsonML format in to compact HTML, and vice versa
 */
const selfClosingTags = new Set(require('html-tags/void'))
const parse5 = require('parse5')
const assert = require('assert')

function domToJsonML (element) {
  if (element.nodeName === '#document') {
    return { JsonML: domToJsonML(element.childNodes.find(x => !x.nodeName.startsWith('#'))) }
  } else if (element.nodeName === '#document-fragment') {
    return ['#document-fragment', ...element.childNodes.map(domToJsonML)]
  } else if (element.nodeName === '#comment') {
    // p5 doesn't know how to parse cdata
    if (element.data.startsWith('[CDATA[') && element.data.endsWith(']]')) {
      return ['#cdata-section', element.data.slice(7, -2)]
    } else {
      return ['#comment', element.data]
    }
  } else if (element.nodeName === '#text') {
    return element.value.trim()
  } else if (!element.nodeName.startsWith('#')) {
    // regular element
    const attrs = element.attrs.map(attr => [attr.prefix ? `${attr.prefix}:${attr.name}` : attr.name, attr.value])
    const children = element.childNodes.map(domToJsonML).filter(x => x)
    if (attrs.length > 0) {
      return [element.tagName, Object.fromEntries(attrs), ...children]
    } else {
      return [element.tagName, ...children]
    }
  }
}

// returns number of occurances of a search character within string
function countChars (string, char) {
  return Array.prototype.reduce.call(string, (prev, x) => x === char ? prev + 1 : prev, 0)
}

// does html encoding escaping to strings in the most minimally invasive way possible, including ambiguous ampersand logic
function esc (string, replaceList) {
  const table = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }
  return string.replace(/(&[#a-zA-Z0-9][a-zA-Z0-9]*;|[<>"'])/g, match => {
    const char = match[0]
    return (replaceList.includes(char) ? table[char] : char) + match.slice(1)
  })
}

function * buildHTML (element) {
  if (typeof element === 'object' && Array.isArray(element)) {
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

Object.assign(exports, {
  handles: ['text/html'],
  extensions: ['html', 'htm'],

  decode (string) {
    const document = parse5.parse(string.toString('utf-8'))
    return domToJsonML(document)
  },

  /**
   * Given a JsonML element, or a string, render it to a HTML string, suitably escaped and structured
   * @param {string|Array} element
   * @returns {string}
   */
  encode (element) {
    if (typeof element === 'object' && !Array.isArray(element) && 'JsonML' in element) {
      return [...buildHTML(['#document', element.JsonML])].join('')
    } else {
      return [...buildHTML(element)].join('')
    }
  }
})
