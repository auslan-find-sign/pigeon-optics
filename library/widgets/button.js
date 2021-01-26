// a basic button, which fires an event when clicked

const widget = require('./basic-widget')
const StyleObject = require('@bluebie/style-object')
const html = require('nanohtml')
const render = require('./utilities/render')

class Button extends widget {
  constructor ({ label = 'Button', hue = 190, style = {}, onClick = () => {}, link = null, type = 'submit' }) {
    super()
    this.style = new StyleObject(style)
    this.label = label
    this.hue = hue
    this.link = link
    this.type = type
    this.onClick = onClick
    this.clickHandler = this.clickHandler.bind(this)
  }
  
  // getter and setter code to map the hue property in to the css styles
  set hue (value) { this.style['--hue'] = `${parseFloat(value)}deg` }
  get hue () { return parseFloat(this.style['--hue']) }
  
  clickHandler (event) {
    console.log(`${this.constructor.name} (${this.label}) clicked`)
    return this.onClick(event)
  }
  
  createElement () {
    const attributes = {
      class: this.className,
      role: 'button',
      style: this.style,
      onclick: this.clickHandler,
    }
    
    if (this.link) {
      return html`<a ${attributes} href="${this.link}">${render(this.label)}</a>`
    } else {
      return html`<button ${attributes} type=${this.type}>${render(this.label)}</button>`
    }
  }
  
  // for live syncing support
  getConstructorOptions () {
    return {
      label: this.label,
      hue: this.hue,
      link: this.link,
      type: this.type,
      onClick: this.onClick
    }
  }
}

module.exports = Button