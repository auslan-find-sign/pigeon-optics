// This file contains more convenient factories for the various widgets available
const Button = require('./widgets/button')
const CardSpread = require('./widgets/card-spread')
const FlexRow = require('./widgets/flex-row')
const Form = require('./widgets/form')
const Heading = require('./widgets/heading')
const HTMLBody = require('./widgets/html-body')
const Link = require('./widgets/link')
const Monospace = require('./widgets/monospace')
const NoticePanel = require('./widgets/notice-panel')
const Paragraph = require('./widgets/paragraph')
const PlayingCard = require('./widgets/playing-card')
const SimpleForm = require('./widgets/simple-form')
const SourceCode = require('./widgets/source-code')
const StyledText = require('./widgets/styled-text')
const Toolbar = require('./widgets/toolbar')

const render = require('./widgets/utilities/render')
const action = require('./widgets/utilities/action')
const Serialize = require('./widgets/utilities/serialize')

const html = require('nanohtml')

const UI = {
  // Array of all the widgets that the UI library will support
  widgets: [
    CardSpread,
    PlayingCard,
    NoticePanel,
    SimpleForm,
    FlexRow,
    Form,
    Toolbar,
    Button,
    Heading,
    Paragraph,
    SourceCode,
    Monospace,
    Link,
    StyledText,
    HTMLBody
  ],

  action: action,

  // makes a html document body
  html (body, { baseUrl = '' }) {
    const markup = html`<!DOCTYPE html>
      <html><head>
        <title>${body.title}</title>
        <link rel="stylesheet" href="${baseUrl}/style.css">
        ${body.headTags}
      </head>${render(body)}</html>`

    return markup.toString()
  },

  // shortcut: create bold text
  bold (text) {
    return this.styledText({ contents: text, effect: 'bold' })
  },
  // shortcut: create italic text
  italic (text) {
    return this.styledText({ contents: text, effect: 'italic' })
  },
  // shortcut: create italic text
  retro (text) {
    return this.styledText({ contents: text, effect: 'retro' })
  },
  // shortcut: create italic text
  glitch (text) {
    return this.styledText({ contents: text, effect: 'glitch' })
  },

  // takes one or more literal htmls, strings, arrays, nanocomponents, or structures
  // made out of those things, and returns one tagged html result
  render,

  // takes html serialised page contents, and reconstitutes it in to live widgets
  reconstitute (serializedWidgetsJSON) {
    const root = Serialize.decode(serializedWidgetsJSON, this.widgets)

    // object that has rpcIDs as keys and widgets as values, to support serverTools.script
    // sending of dehydrated widgets, and rpc event-stream live syncing
    const widgets = Object.fromEntries(root.listWidgets().map(x => [x.rpcID, x]))

    return { widgets, root }
  },

  async implementRPC (root, rpcMessage) {
    console.log('Widget Patch List:', rpcMessage.patchList)
    const widgetList = root.listWidgets()

    if (rpcMessage.patchList) {
      for (const rpcID in rpcMessage.patchList) {
        const patch = rpcMessage.patchList[rpcID]
        const widget = widgetList.find(x => x.rpcID === rpcID)

        // todo: handle newly created widgets down the tree
        if (!widget) return console.error('Widget not found', rpcID)

        widget.mergeRPCUpdate(patch)
        // render the updated local widget
        widget.render()
      }
    }

    if (rpcMessage.actionList) {
      for (const act of rpcMessage.actionList) {
        act()
      }
    }
  },

  // automatically used when the live: true option is on, to connect over SSE and get
  // updates to the page state
  connectLive (widgetData, liveAccessKey) {
    const args = { pageID: widgetData.root.rpcID, liveAccessKey }
    const queryString = Object.entries(args).map(([key, value]) =>
      `${key}=${encodeURIComponent(value)}`
    ).join('&')
    const url = window.location.pathname + '?' + queryString
    const configuration = { withCredentials: true }
    this.pubsubSource = new window.EventSource(url, configuration)

    // when the server sends messages, this code receives them
    this.pubsubSource.onmessage = async (messageEvent) => {
      const message = Serialize.decode(messageEvent.data, this.widgets, window.__widgetData.root.listWidgets())
      if (message.patchList || message.actionList) {
        await this.implementRPC(widgetData.root, message)
      } else if (message.disconnect) {
        console.log('Server requested browser disconnect, closing EventSource')
        this.pubsubSource.close()
      }
    }
  }
}

// iterate through widgets, creating handy functions like UI.cardSpread()
for (const Widget of UI.widgets) {
  // name is the same as the class name e.g. StyledText but with the first letter lowercased
  const name = Widget.name.replace(/^[A-Z]/, letter => letter.toLowerCase())
  const shortcut = (...args) => new Widget(...args)
  UI[name] = shortcut
}

module.exports = UI
