/**
 * VibeBuilder is based on Markaby and html-maker ideas
 * for use with regular javascript
 */
const SelfClosingTags = new Set(require('html-tags/void'))
const Tags = new Set(require('html-tags'))
const { PassThrough } = require('stream')

const hyphenate = (string) => `${string}`.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase()
const escapeAttribute = (string) => string.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const escapeText = (string) => string.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

class VibeBuilder {
  /** Runs a callback function, giving it an argument 'v' which is a VibeBuilder instance
   * @returns {Stream}
   */
  static renderStream (block) {
    const v = new this()
    const stream = new PassThrough()

    v._rawText = (html) => {
      if (typeof html === 'string' && html.length > 0) {
        stream.write(html)
      } else {
        console.error('tried to push non-string to html stream output')
      }
    }

    (async () => {
      await block(v)
      stream.end('')
    })()

    return stream
  }

  /** Runs a callback function, giving it an argument 'v' VibeBuilder instance, then returns a string html document */
  static async renderString (block) {
    const v = new this()
    const strings = []
    v._rawText = (html) => strings.push(html)
    await block(v)
    return strings.join('')
  }

  /** create a html tag with specified name
   * @param {string} tagName - the name of the xml tag
   * @param {object} attributes - keys and values to use as attributes on the tag, with special handling of style and data props
   * @param {string} body - text contents to put inside this tag
   * @param {function} block - function which builds internal tags indented inside this one
   */
  tag (tagName, ...args) {
    const block = args.find(x => typeof x === 'function')
    const attribs = args.find(x => typeof x === 'object')
    const stringContents = args.find(x => typeof x === 'string')
    const selfClosing = SelfClosingTags.has(tagName.toLowerCase())

    // emit opening tag
    const attribsString = Object.entries(attribs || {}).map(([key, value]) => {
      if (key === 'style' && typeof value === 'object') {
        value = Object.entries(value).map(([prop, cssValue]) => `${hyphenate(prop)}:${cssValue}`).join(';')
      }

      if (key === 'innerHTML') {
        return ''
      } else if (value === true) {
        return ` ${hyphenate(key)}`
      } else if (!value) {
        return ''
      } else if (typeof value === 'object' && key === 'data') {
        return Object.entries(value).map(([prop, propVal]) => {
          if (typeof propVal !== 'string') propVal = JSON.stringify(propVal)
          propVal = escapeAttribute(propVal)
          if (!propVal.match(/^[^ "'`=<>]*$/mg)) propVal = `"${propVal}"`
          return ` data-${escapeAttribute(hyphenate(prop))}=${propVal}`
        }).join('')
      } else {
        value = escapeAttribute(`${value}`)
        if (!value.match(/^[^ "'`=<>]*$/mg)) value = `"${value}"`
        return ` ${escapeAttribute(hyphenate(key))}=${value}`
      }
    }).join('')

    this._rawText(`<${tagName}${attribsString}>`)

    if (attribs && attribs.innerHTML) {
      this._rawText(attribs.innerHTML)
    } else {
      if (block) block(this)
      if (stringContents) this.text(stringContents)
    }

    // emit closing tag if needed
    if (!selfClosing) this._rawText(`</${tagName}>`)
  }

  /**
   * add escaped text to the document, unless it's a nanohtml server side string then it's inserted unescaped
   * @param {string} string
   */
  text (string) {
    if (!string.__encoded === true) string = escapeText(string)
    this._rawText(string)
  }

  /** insert something that behaves like a nanocomponent
   * @param {object} - object that responds to .render(), .toHTML(), or toString() with html codes
   */
  component (component) {
    let html
    if ('render' in component) {
      html = component.render()
    } else if ('toHTML' in component) {
      html = component.toHTML()
    } else {
      html = `${component}`
    }
    this._rawText(html)
  }

  doctype (typeString = 'html') {
    this._rawText(`<!DOCTYPE ${escapeAttribute(typeString)}>\n`)
  }
}

// make convenience html tag methods available
for (const tagName of Tags) {
  VibeBuilder.prototype[tagName] = function (...args) {
    return this.tag(tagName, ...args)
  }
}

module.exports = VibeBuilder
