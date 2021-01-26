// This file describes a spread of cards
const widget = require('./basic-widget')
const html = require('nanohtml')
const render = require('./utilities/render')

class CardSpread extends widget {
  constructor ({ cards = [] }) {
    super()
    this.cards = cards
  }
  
  // create the html for this card spread, containing all the cards in the this.cards array
  createElement () {
    return html`<div class="${this.className}">${render(this.cards)}</div>`
  }
  
  // for live syncing support
  getConstructorOptions () {
    return { cards: this.cards }
  }
}

module.exports = CardSpread