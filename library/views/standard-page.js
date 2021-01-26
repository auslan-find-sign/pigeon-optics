const ui = require('../ui')
const html = require('nanohtml')

module.exports = () => {
  return [
    // heading bar
    ui.flexRow({
      contents: [
        html`<a href="/"><img src="/design/datasets-icon.png" alt="Datasets"></a>`
      ]
    })
  ]
}
