/**
 * HTML codec, transforms JsonML format in to compact HTML, and vice versa
 */
const toAttributes = require('../../vibe/to-attributes')
const escapeText = require('../../vibe/escape-text')
const escapeAttribute = require('../../vibe/escape-attribute')
const selfClosingTags = new Set(require('html-tags/void'))
const parse5 = require('parse5')

function domToJsonML (element) {
  if (element.nodeName === '#document') {
    return { JsonML: domToJsonML(element.childNodes.find(x => !x.nodeName.startsWith('#'))) }
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
    if (element && typeof element === 'object' && Array.isArray(element.JsonML)) {
      return `<!DOCTYPE html>\n${this.encode(element.JsonML)}`
    }
    if (typeof element === 'string') return escapeText(element)
    if (!Array.isArray(element)) throw new Error('Element must be an Array or a string, but it\'s ' + JSON.stringify(element))
    const children = [...element]
    const tag = children.shift()
    let attribs = {}
    if (children[0] && typeof children[0] === 'object' && !Array.isArray(children[0])) {
      attribs = children.shift()
    }

    if (typeof tag !== 'string') throw new Error('First element of Array must be string tag name')
    const isSelfClosing = selfClosingTags.has(tag.toLowerCase())

    const output = [`<${escapeAttribute(tag)}${toAttributes(attribs)}>`]
    if (isSelfClosing) {
      if (children.length > 0) throw new Error(`<${tag}> is self closing, children aren't allowed`)
    } else {
      children.forEach(child => {
        output.push(this.encode(child))
      })
      output.push(`</${escapeAttribute(tag)}>`)
    }

    return output.join('')
  }
})
