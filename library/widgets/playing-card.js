// This file describes a playing card which can have customisable text
const widget = require('./basic-widget')
const StyleObject = require('@bluebie/style-object')
const html = require('nanohtml')
const render = require('./utilities/render')

class PlayingCard extends widget {
  constructor ({ symbol = '❓', title = 'Card Title', contents = 'Card Text', invert = false, link = null, style = {} }) {
    super()
    this.symbol = symbol
    this.title = title
    this.contents = contents
    this.invert = invert
    this.link = link
    this.style = new StyleObject(style)
  }
  
  // create the html for this playing card using the object's attributes to fill in
  // all the details
  createElement () {
    // build a list of the css classes to specify
    const classes = [this.className]
    if (this.invert) classes.push('invert')
    
    // list of html markup to include inside the card
    const pieces = [
      html`<span class="symbol">${render(this.symbol)}</span>`,
      html`<span class="title">${render(this.title)}</span>`,
      html`<span class="text">${render(this.contents)}</span>`
    ]
    
    const attributes = {
      class: classes.join(' '),
      style: this.style
    }
    
    // if it's a link, make a link tag, otherwise just a div is fine
    if (this.link) {
      return html`<a ${attributes} href="${this.link}">${pieces}</a>`
    } else {
      return html`<div ${attributes}>${pieces}</div>`
    }
  }
  
  // for live syncing support
  getConstructorOptions () {
    return {
      contents: this.contents,
      title: this.title,
      symbol: this.symbol,
      invert: this.invert,
      link: this.link,
      style: this.style.values()
    }
  }
}

module.exports = PlayingCard