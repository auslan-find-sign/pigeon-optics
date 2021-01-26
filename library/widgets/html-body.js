// html body
const html = require('nanohtml')
const widget = require('./basic-widget')
const render = require('./utilities/render')

class HTMLBody extends widget {
  constructor ({ title = 'Webpage', contents = [] }) {
    super()
    this.contents = contents
    this.title = title
    this.headTags = []
  }

  // make the html code
  createElement () {
    // if we're running in the browser, where a global window object exists, update title
    if (typeof window === 'object') {
      document.title = this.title
    }
    // update the body tag
    return html`<body>${render(this.contents)}</body>`
  }

  // for live syncing support
  getConstructorOptions () {
    return { title: this.title, contents: this.contents }
  }

  // if the page is made with { live: true } this asks the browser to disconnect and stop getting updates
  // which can be useful to reduce memory use on the server if you have nothing more to say
  disconnect () {
    setTimeout(() => this.sendRemoteEvent({ disconnect: true }), 0)
  }
}

module.exports = HTMLBody
