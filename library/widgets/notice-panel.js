// This file describes an error notice, for creating error pages or simple informational notices
const widget = require('./basic-widget')
const StyleObject = require('@bluebie/style-object')
const html = require('nanohtml')
const render = require('./utilities/render')

class NoticePanel extends widget {
  constructor ({ title = 'Notice', contents = '', style = {} }) {
    super()
    this.title = title
    this.contents = contents
    this.style = new StyleObject(style)
  }
  
  // create the html for this card spread, containing all the cards in the this.cards array
  createElement () {
    return html`<div class="${this.className}" style="${this.style}">
      <h1>${render(this.title)}</h1>
      <div>
        ${render(this.contents)}
      </div>
    </div>`
  }
  
  // for live syncing support
  getConstructorOptions () {
    return { contents: this.contents, title: this.title, style: this.style.values() }
  }
}

module.exports = NoticePanel