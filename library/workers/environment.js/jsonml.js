const elParents = new WeakMap()
const treeSelector = require('tree-selector')

const adapter = {
  tag (node) { return node[0] || '' },
  id (node) { return this.attr(node, 'id') || '' },
  className (node) { return this.attr(node, 'class') || '' },
  parent (node) { return elParents.get(node) },
  children (node) {
    return node.filter((v, i) => i >= 2 && this.isTag(v))
  },
  attr (node, attr) {
    return node[1] && node[1][attr]
  },

  // ducktype a JsonML tag
  isTag (node) {
    return Array.isArray(node) && typeof node[0] === 'string' && node[1] && typeof node[1] === 'object'
  },
  // getChildren (node) { return node.slice(2) },
  // getParent (node) { return elParents.get(node) || null },

  // getTagName (node) { return node[0] },
  // getSiblings (node) { return this.getChildren(this.getParent(node)) },

  // like Element#textContents textContent dom api
  contents (node) {
    if (typeof node === 'string') {
      return node
    } else if (this.isTag(node)) {
      return node.slice(2).map(x => this.contents(x)).join('')
    } else {
      throw new Error(`Unexpected data structure ${JSON.stringify(node)}`)
    }
  }
}

const querySelector = treeSelector.createQuerySelector(adapter)
/**
 * Query a JsonML xml document using a css selector string, get an array of results
 * @param {JsonMLElement} root - root element of the document, or an object with a JsonML property containing such
 * @param {*} selector - basic CSS selector to query the document with
 * @returns {JsonMLElement[]}
 */
exports.select = function select (root, selector) {
  // for docs wrapped in { JsonML: ... } unpack that firstly
  if (root && typeof root === 'object' && adapter.isTag(root.JsonML)) root = root.JsonML
  if (!adapter.isTag(root)) throw new Error('first argument to select must be a JsonML Element array')

  // build parents metadata necessary to emulate dom api
  function walk (node) {
    if (adapter.isTag(node)) {
      for (const child of adapter.children(node)) {
        elParents.set(child, node)
        walk(child, node)
      }
    }
  }
  walk(root)
  elParents.delete(root)

  return querySelector(selector, root)
}

/**
 * convert JsonML elements in to just their text content, like DOMElement#textContents
 * @param {JsonMLElement|JsonMLElement[]} element - JsonMLElement, which is an Array, or an array of those to concat
 * @returns {string}
 */
exports.text = function textContents (element) {
  if (element && Array.isArray(element) && element.every(x => adapter.isTag(x))) return element.map(x => adapter.contents(x)).join('')
  if (element && typeof element === 'object' && Array.isArray(element.JsonML)) element = element.JsonML
  return adapter.contents(element)
}

/**
 * read attribute value of a JsonML Element
 * @param {JsonMLElement} element - JsonMLElement, which is an Array
 * @param {string} attributeName
 * @returns {string}
 */
exports.attr = function getAttribute (element, attributeName) {
  if (adapter.isTag(element)) {
    return adapter.attr(element, attributeName)
  }
}

const toAttributes = require('../../vibe/to-attributes')
const escapeText = require('../../vibe/escape-text')
const escapeAttribute = require('../../vibe/escape-attribute')
const selfClosingTags = new Set(require('html-tags/void'))
/**
 * Given a JsonML element, or a string, render it to a HTML string, suitably escaped and structured
 * @param {string|Array} element
 * @returns {string}
 */
exports.toHTML = function jsonmlToHTML (element) {
  if (element && typeof element === 'object' && Array.isArray(element.JsonML)) element = element.JsonML
  if (typeof element === 'string') return escapeText(element)
  if (!Array.isArray(element)) throw new Error('Element must be an Array')
  const [tag, attribs, ...children] = element
  if (typeof tag !== 'string') throw new Error('First element of Array must be string tag name')
  if (!attribs || typeof attribs !== 'object' || Array.isArray(attribs)) throw new Error('Second element of Array must be an object of attributes')
  const isSelfClosing = selfClosingTags.has(tag.toLowerCase())

  const output = [`<${escapeAttribute(tag)}${toAttributes(attribs)}>`]
  if (isSelfClosing) {
    if (children.length > 0) throw new Error(`<${tag}> is self closing, children aren't allowed`)
  } else {
    children.forEach(child => {
      output.push(exports.toHTML(child))
    })
    output.push(`</${escapeAttribute(tag)}>`)
  }

  return output.join('')
}

/**
 * Given a JsonML element, or a string, render it to an XML string, suitably escaped and structured
 * @param {string|Array} element
 * @returns {string}
 */
exports.toXML = function jsonmlToXML (element) {
  if (element && typeof element === 'object' && Array.isArray(element.JsonML)) element = element.JsonML
  if (typeof element === 'string') return escapeText(element)
  if (!Array.isArray(element)) throw new Error('Element must be an Array')
  const [tag, attribs, ...children] = element
  if (typeof tag !== 'string') throw new Error('First element of Array must be string tag name')
  if (!attribs || typeof attribs !== 'object' || Array.isArray(attribs)) throw new Error('Second element of Array must be an object of attributes')

  if (children.length > 0) {
    return [
      `<${escapeAttribute(tag)}${toAttributes(attribs, { xml: true })}>`,
      ...children.map(x => this.toXML(x)),
      `</${escapeAttribute(tag)}>`
    ].join('')
  } else {
    return `<${escapeAttribute(tag)}${toAttributes(attribs, { xml: true })}/>`
  }
}
