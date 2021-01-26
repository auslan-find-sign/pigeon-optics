// simple html paragraph tag
const html = require('nanohtml')
const widget = require('./basic-widget')
const StyleObject = require('@bluebie/style-object')
const render = require('./utilities/render')

class Paragraph extends widget {
  constructor({ contents = [], style = {} }) {
    super()
    this.contents = contents
    this.style = new StyleObject(style)
  }
  
  createElement () {
    return html`<p class="${this.className}" style="${this.style}">${render(this.contents)}</p>`
  }
  
  // for live syncing support
  getConstructorOptions () {
    return { contents: this.contents, style: this.style.values() }
  }
}

module.exports = Paragraph