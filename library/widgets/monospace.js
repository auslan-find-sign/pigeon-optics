// simple html pre tag for monospace ascii text
const html = require('nanohtml')
const widget = require('./basic-widget')
const StyleObject = require('@bluebie/style-object')
const render = require('./utilities/render')

class Monospace extends widget {
  constructor ({ contents = [], style = {} }) {
    super()
    this.contents = contents
    this.style = new StyleObject(style)
  }

  // make the html code
  createElement () {
    return html`<pre class="${this.className}" style="${this.style}">${render(this.contents)}</pre>`
  }

  // for live syncing support
  getConstructorOptions () {
    return { contents: this.contents, style: this.style.values() }
  }
}

module.exports = Monospace
