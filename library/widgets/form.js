// This file describes a form which can ask for user input to be submitted
const widget = require('./basic-widget')
const html = require('nanohtml')
const render = require('./utilities/render')
const action = require('./utilities/action.js')

function makeID () {
  return 'simple-form-' + Math.floor((1 + Math.random()) * 0x10000).toString(16).substring(1)
}

class Form extends widget {
  constructor ({ contents = [], url = '', method = 'POST', onSubmit = null }) {
    super()
    this.url = url
    this.method = method
    this.contents = contents
    this.onSubmit = onSubmit
  }
  
  // create the html for this card spread, containing all the cards in the this.cards array
  createElement () {
    const formAttributes = {
      class: this.className,
      action: this.url,
      method: this.method,
      onsubmit: this.onSubmit
    }
    
    return html`<form ${formAttributes}>${render(this.contents)}</form>`
  }
  
  // for live syncing support
  getConstructorOptions () {
    return {
      url: this.url,
      method: this.method,
      contents: this.contents,
      onSubmit: this.onSubmit
    }
  }
}

module.exports = Form