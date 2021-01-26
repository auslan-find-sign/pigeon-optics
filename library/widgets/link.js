// simple <a> link
const html = require('nanohtml')
const widget = require('./basic-widget')
const StyleObject = require('@bluebie/style-object')
const render = require('./utilities/render')

class Link extends widget {
  constructor ({ contents = [], url = '', style = {} }) {
    super()
    this.contents = contents
    this.url = url
    this.style = new StyleObject(style)
  }

  createElement () {
    return html`<a class="${this.className}" style="${this.style}" href="${this.url}">${render(this.contents)}</a>`
  }

  // for live syncing support
  getConstructorOptions () {
    return { contents: this.contents, url: this.url, style: this.style.values() }
  }
}

module.exports = Link
