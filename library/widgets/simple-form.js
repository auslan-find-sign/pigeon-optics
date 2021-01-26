// This file describes a form which can ask for user input to be submitted
const widget = require('./basic-widget')
const Nanocomponent = require('nanocomponent')
const html = require('nanohtml')
const Button = require('./button')
const render = require('./utilities/render')

class SimpleForm extends widget {
  constructor ({ title = 'Simple Form', fields = {}, url = '', method = 'POST', buttonLabel = 'Submit', memo = '', onSubmit = null }) {
    super()
    this.title = title
    this.fields = fields
    this.memo = memo
    this.url = url
    this.method = method
    this.buttonLabel = buttonLabel
    this.onSubmit = onSubmit
  }

  // create the html for this card spread, containing all the cards in the this.cards array
  createElement () {
    const title = html`<h1>${render(this.title)}</h1>`

    const memo = render(this.memo) // extra html to inject before the form fields

    const fields = Object.entries(this.fields).flatMap(([name, options]) => {
      const fieldID = `${this.rpcID}-${name}`
      const label = html`<dt><label for="${fieldID}">${render(options.label || name)}</label></dt>`
      let input
      if (typeof options === 'string' || options instanceof Nanocomponent) {
        // maybe it's text, a nanocomponent/basic-widget, or a html string literal of some fancy form stuff. just render it
        input = html`<dd>${render(options)}</dd>`
      } else {
        // looks like options describing a form input, use it!
        input = html`<dd><input id="${fieldID}" type="${options.type || 'text'}" name="${name}" value="${options.value}"></dd>`
      }

      return [label, input]
    })

    const fieldList = html`<dl>${fields}</dl>`
    const button = new Button({ label: this.buttonLabel, type: 'submit' })

    const formAttributes = {
      class: this.className,
      id: this.rpcID,
      action: this.url,
      method: this.method,
      onsubmit: this.onSubmit
    }

    return html`<form ${formAttributes}>
      ${title}
      ${memo}
      ${fieldList}
      ${render(button)}
    </form>`
  }

  // for live syncing support
  getConstructorOptions () {
    return {
      title: this.title,
      fields: this.fields,
      url: this.url,
      method: this.method,
      buttonLabel: this.buttonLabel,
      onSubmit: this.onSubmit
    }
  }
}

module.exports = SimpleForm
