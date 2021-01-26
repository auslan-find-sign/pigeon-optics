// takes one or more literal htmls, strings, arrays, nanocomponents, or structures made out of those things, and
// returns one tagged html result
const html = require('nanohtml')
const raw = require('nanohtml/raw')
const BasicWidget = require('../basic-widget')

function render (...inputs) {
  // flatten any array structures
  const flattened = inputs.flat(Infinity)
  // call render on any components, escape any unescaped stuff that should be escaped, using html``
  const rendered = flattened.map(item => {
    if (item instanceof BasicWidget) {
      return item.render()
    } else {
      return html`${item}`
    }
  })
  
  // return the rendered version
  return rendered
}

module.exports = render