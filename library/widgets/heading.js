// simple html heading tag
const html = require('nanohtml')
const widget = require('./basic-widget')
const StyleObject = require('@bluebie/style-object')
const render = require('./utilities/render')

class Heading extends widget {
  constructor({ contents = [], level = 1, style = {}}) {
    super()
    this.contents = contents
    this.level = parseInt(level)
    if (typeof this.level !== 'number' || Math.round(this.level) !== this.level) {
      throw new Error('level must be an integer Number')
    }
    if (this.level < 1 || this.level > 6) {
      throw new Error('level must be a value between 1 and 6 inclusive')
    }
    this.style = new StyleObject(style)
  }
  
  createElement () {
    if (this.level === 1) {
      return html`<h1 class="${this.className}" style="${this.style}">${render(this.contents)}</h1>`
    } else if (this.level === 2) {
      return html`<h2 class="${this.className}" style="${this.style}">${render(this.contents)}</h2>`
    } else if (this.level === 3) {
      return html`<h3 class="${this.className}" style="${this.style}">${render(this.contents)}</h3>`
    } else if (this.level === 4) {
      return html`<h4 class="${this.className}" style="${this.style}">${render(this.contents)}</h4>`
    } else if (this.level === 5) {
      return html`<h5 class="${this.className}" style="${this.style}">${render(this.contents)}</h5>`
    } else if (this.level === 5) {
      return html`<h6 class="${this.className}" style="${this.style}">${render(this.contents)}</h6>`
    }
  }
  
  // for live syncing support
  getConstructorOptions () {
    return { contents: this.contents, level: this.level, style: this.style.values() }
  }
}

module.exports = Heading