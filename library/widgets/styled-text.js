// simple span tag allowing styling
const html = require('nanohtml')
const widget = require('./basic-widget')
const StyleObject = require('@bluebie/style-object')
const render = require('./utilities/render')

class StyledText extends widget {
  constructor ({ contents = '', effect = null, style = {} }) {
    super()
    this.contents = contents
    this.effect = effect
    this.style = new StyleObject(style)

    if (this.effect && !StyledText.effects.includes(this.effect)) {
      throw new Error(`Unknown effect ${this.effect}, must be one of ${StyledText.effects.join(', ')} or null`)
    }
  }

  createElement () {
    const classList = [this.className]
    if (this.effect) {
      classList.push(this.effect)
    }

    const attributes = { class: classList.join(' ') }
    if (Object.keys(this.style.values()).length > 0) {
      attributes.style = this.style
    }

    return html`<span ${attributes}>${render(this.contents)}</span>`
  }

  // for live syncing support
  getConstructorOptions () {
    return {
      contents: this.contents,
      style: this.style.values()
    }
  }
}

StyledText.effects = [
  'bold',
  'italic',
  'retro',
  'glitch'
]

module.exports = StyledText
