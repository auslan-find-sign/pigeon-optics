// simple html pre tag with javascript syntax highlighting
const html = require('nanohtml')
const raw = require('nanohtml/raw')
const widget = require('./basic-widget')
const StyleObject = require('@bluebie/style-object')
const highlight = require('h.js')

class SourceCode extends widget {
  constructor ({ contents = '', language = 'javascript', onClick = null, style = {} }) {
    super()
    this.contents = contents
    this.language = language
    this.onClick = onClick
    this.style = new StyleObject(style)

    if (this.language !== 'javascript') {
      throw new Error('only javascript is supported currently')
    }

    this.clickHandler = this.clickHandler.bind(this)
  }

  clickHandler (event) { }

  createElement () {
    let code = this.contents
    if (typeof code !== 'string') {
      // stringify anything that isn't a string using JSON
      code = JSON.stringify(code, null, 2)
    }

    // syntax highlight the javascript/json
    const highlighted = highlight(code)
    // add line numbers and some structure to this output
    const lineNumbered = highlighted.split('\n').flatMap(line => {
      return html`<code>${raw(line)}</code>\n`
    })

    // generate a little hint for css so it can layout the line numbers with the right width because CSS grid is a pain with the line hover highlighting styles
    const digits = lineNumbered.length.toString().length
    this.style.setVariables({ digits: `${digits}` })

    return html`<div class="${this.className}" style="${this.style}" data-language="${this.language}" onclick="${this.clickHandler}">${lineNumbered}</div>`
  }

  // for live syncing support
  getConstructorOptions () {
    return {
      contents: this.contents,
      language: this.language,
      style: this.style.values()
    }
  }
}

module.exports = SourceCode
