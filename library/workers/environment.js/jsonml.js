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
