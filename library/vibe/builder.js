/**
 * VibeBuilder is based on Markaby and html-maker ideas
 * for use with regular javascript
 */
const SelfClosingTags = new Set(require('html-tags/void'))
const Tags = new Set(require('html-tags'))
const { PassThrough } = require('stream')

const hyphenate = (string) => `${string}`.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase()
const escapeAttribute = (string) => `${string}`.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const escapeText = (string) => `${string}`.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

// handle 'data' attribute with object value, converting in to data-prop-name=value1 type of formatting for html data attributes / dataset
const attributeMapDataConvert = (tagName, key, value) => {
  if (key === 'data' && typeof value === 'object' && value !== null /* I hate you */) {
    return Object.entries(value).map(([propName, propVal]) => {
      if (typeof propVal !== 'string') propVal = JSON.stringify(propVal)
      return [`data-${propName}`, propVal]
    })
  } else {
    return [[key, value]]
  }
}

// handle 'style' attribute with object value, converting in to a style attribute
const attributeMapStyleConvert = (tagName, key, value) => {
  if (key === 'style' && typeof value === 'object' && value !== null /* I hate you */) {
    return Object.entries(value).map(([propName, propVal]) => `${hyphenate(propName)}:${propVal}`).join(';')
  } else {
    return [[key, value]]
  }
}

// handle class/rel type attributes, which can be a list
const attributeMapListConvert = (tagName, key, value) => {
  if (Array.isArray(value) && ['rel', 'class', 'for', 'aria-labeledby', 'ping'].includes(key)) {
    return [[key, value.join(' ')]]
  } else {
    return [[key, value]]
  }
}

// handle 'style' attribute with object value, converting in to a style attribute
const attributeMapDropReservedKeys = (tagName, key, value) => {
  if (['innerHTML'].includes(key)) return []
  return [[key, value]]
}

// somewhere to store private information
const secretData = new WeakMap()
function secret (obj) {
  return secretData.get(obj)
}

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

    // override pipe to detect flush method on compressed express responses and hook it up
    const oldPipe = stream.pipe
    stream.pipe = function (destination, ...args) {
      if (destination.flush) v.flush = () => destination.flush()
      if (destination.type) destination.type('html')
      return oldPipe.call(stream, destination, ...args)
    }

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

  /** constructs a new VibeBuilder, with options
   * @param {VibeOptions} options
   * @typedef {object} VibeOptions
   * @property {function} attributeMapFunction - function (tagName, attributeName, attributeValue) { return [attributeName, attributeValue] }
   */
  constructor (options = {}) {
    secretData.set(this, { options })
  }

  /** processes args to this.tag() and returns an attributes string safe to stream out in html */
  _attributeStringFromArgs (tagName, ...args) {
    const options = secret(this).options
    const objs = args.filter(x => typeof x === 'object' && x !== null /* I hate you */)
    let entries = objs.flatMap(x => Object.entries(x))
    const attribFilters = [
      attributeMapDropReservedKeys,
      attributeMapDataConvert,
      attributeMapListConvert,
      attributeMapStyleConvert
    ]

    if (options.attributeMapFunction) attribFilters.unshift(options.attributeMapFunction)

    // run attribute filters to do any adjustments needed and clean them up
    for (const mapFn of attribFilters) {
      entries = entries.flatMap(([key, value]) => {
        const result = mapFn(tagName, key, value)
        if (Array.isArray(result)) return result
        else return [[key, result]]
      })
    }

    return entries.map(([key, value]) => {
      if (value === false) {
        return ''
      } else if (value === true) {
        return ` ${escapeAttribute(hyphenate(`${key}`))}`
      } else {
        value = escapeAttribute(value)
        if (!value.match(/^[^ "'`=<>]+$/mg)) value = `"${value}"`
        return ` ${escapeAttribute(hyphenate(`${key}`))}=${value}`
      }
    }).join('')
  }

  /** create a html tag with specified name
   * @param {string} tagName - the name of the xml tag
   * @param {object} attributes - keys and values to use as attributes on the tag, with special handling of style and data props
   * @param {string} body - text contents to put inside this tag
   * @param {function} block - function which builds internal tags indented inside this one, can be async, but if it is, be careful to await tag
   */
  async tag (tagName, ...args) {
    const block = args.find(x => typeof x === 'function')
    const attribs = Object.fromEntries(
      args.filter(x => typeof x === 'object' && x !== null /* I hate you */)
        .flatMap(x => Object.entries(x)))
    const stringContents = args.find(x => typeof x === 'string')
    const selfClosing = SelfClosingTags.has(tagName.toLowerCase())

    // emit opening tag
    const attribsString = this._attributeStringFromArgs(tagName, ...args)

    this._rawText(`<${escapeAttribute(tagName)}${attribsString}>`)

    if (attribs && attribs.innerHTML) this._rawText(attribs.innerHTML)
    if (stringContents) this.text(stringContents)
    if (block) {
      if (block.constructor.name === 'AsyncFunction') {
        await block(this)
      } else {
        block(this)
      }
    }

    // emit closing tag if needed
    if (!selfClosing) this._rawText(`</${escapeAttribute(tagName)}>`)
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

  // defaults to do nothing, but can be useful for streaming output
  flush () {

  }

  // special case, script has strange escaping rules
  style (...args) {
    const attribs = args.find(x => typeof x === 'object' && x !== null /* I hate you */) || {}
    const stringContents = args.find(x => typeof x === 'string') || ''
    // for inline styles, if there's data that would glitch the html parser, base64 encode the whole blob to avoid it
    if (stringContents.includes('</')) {
      const datauri = `data:text/javascript;base64,${Buffer.from(stringContents).toString('base64')}`
      this.tag('style', attribs, `@import url("${datauri}");`)
    } else {
      this.tag('style', attribs, v => v._rawText(stringContents))
    }
  }

  // special case, script has strange escaping rules
  script (...args) {
    const attribs = args.find(x => typeof x === 'object' && x !== null /* I hate you */) || {}
    const stringContents = args.find(x => typeof x === 'string')
    if (stringContents) {
      // if there is an inline script, with some suss maybe parser breaking markup, do data uri embedding
      if (stringContents.includes('</')) {
        const uriAttribs = { src: `data:text/javascript;base64,${Buffer.from(stringContents).toString('base64')}`, ...attribs }
        this.tag('script', uriAttribs)
      } else {
        this.tag('script', attribs, v => v._rawText(stringContents))
      }
    } else {
      this.tag('script', attribs)
    }
  }
}

// make convenience html tag methods available
for (const tagName of Tags) {
  VibeBuilder.prototype[tagName] = VibeBuilder.prototype[tagName] || function (...args) {
    return this.tag(tagName, ...args)
  }
}

module.exports = VibeBuilder
