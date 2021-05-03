const treeSelector = require('tree-selector')
const treeAdapter = require('pigeonmark-utils/library/tree-selector-adapter')
const utils = require('pigeonmark-utils')

const querySelector = treeSelector.createQuerySelector(treeAdapter)
/**
 * Query a JsonML xml document using a css selector string, get an array of results
 * @param {utils.PMRootNode} root - root element of the document, or an object with a JsonML property containing such
 * @param {string} selector - basic CSS selector to query the document with
 * @returns {utils.PMNode[]}
 */
exports.select = function select (root, selector) {
  // get treeAdapter to learn the child -> parent mapping, necessary for css selecting
  treeAdapter.scan(root)
  return querySelector(selector, root)
}

exports.get = utils.get
exports.set = utils.set
exports.isPigeonMark = utils.isPigeonMark

/**
 * Given a JsonML element, or a string, render it to a HTML string, suitably escaped and structured
 * @param {utils.PMRootNode} element
 * @returns {string}
 */
exports.toHTML = require('pigeonmark-html/library/encode')

/**
 * Given a JsonML element, or a string, render it to a HTML string, suitably escaped and structured
 * @param {utils.PMRootNode} element
 * @returns {string}
 */
exports.toXML = require('pigeonmark-xml/library/encode')
