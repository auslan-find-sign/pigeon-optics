// This file describes a row like an app toolbar with entries spread across a row
const widget = require('./basic-widget')
const StyleObject = require('@bluebie/style-object')
const html = require('nanohtml')
const render = require('./utilities/render')

class FlexRow extends widget {
  // items can be any nanocomponents, strings, html tag templates, or integer numbers
  // if they're an integer number, they describe a spring, which creates a stretchy gap
  // bigger integer numbers make bigger gaps
  // justify can be any valid value for CSS 'justify-content' property
  constructor ({ contents = [], justify = 'flex-start', wrap = false, style = {} }) {
    super()
    this.contents = contents
    this.justify = justify
    this.wrap = wrap
    
    this.style = new StyleObject({
      justifyContent: () => this.justify !== 'flex-start' ? this.justify : null,
      flexWrap: () => this.wrap ? 'wrap' : null,
      ...style
    })
  }
  
  // create the html for this flex row, containing all the cards in the this.cards array
  createElement () {
    // convert numbers to springs
    const spring = (pressure) => html`<span class="spring" style="flex-grow: ${pressure}"></span>`
    const contents = this.contents.map(i => typeof i === 'number' ? spring(i) : i)
    // output the html structure
    return html`<div class="${this.className}" style="${this.style}">${render(contents)}</div>`
  }
  
  // for live syncing support
  getConstructorOptions () {
    return { contents: this.contents, justify: this.justify, wrap: this.wrap }
  }
}

module.exports = FlexRow