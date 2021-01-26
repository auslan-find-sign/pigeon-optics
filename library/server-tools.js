const ui = require('./ui')
const html = require('nanohtml')
const raw = require('nanohtml/raw')
const BasicWidget = require('./widgets/basic-widget')
const HTMLBody = require('./widgets/html-body')
const SSE = require('sse-writer')
const crypto = require('crypto')
const Serialize = require('./widgets/utilities/serialize')

// cache of response body's where live was enabled
const liveBodyCache = {}
const liveBodyCacheTimeout = 60 * 1000
const liveCallbacks = new WeakMap()
const cleanLiveBodyCache = () => {
  const expire = Date.now() - liveBodyCacheTimeout
  for (const key of Object.keys(liveBodyCache)) {
    if (liveBodyCache[key].responseTimestamp < expire) {
      const callbacks = liveCallbacks.get(liveBodyCache[key])
      liveCallbacks.delete(liveBodyCache[key])
      delete liveBodyCache[key]

      if (callbacks) {
        callbacks.connect.reject(new Error("Browser never connected to live stream. Maybe javascript disabled in user's brower?"))
        callbacks.disconnect.reject(new Error("Browser never connected to live stream. Maybe javascript disabled in user's brower?"))
      }
    }
  }
}

const ServerTools = {
  // responds to a web request with a dynamically built html document
  sendWebpage (req, res, options) {
    // make sure contents is an array, simplifies things later
    if (!Array.isArray(options.contents)) options.contents = [options.contents]

    const body = new HTMLBody(options)

    // warn users of the dangers of using live and script at the same time
    if (options.live && options.script) {
      console.warn('Using live and script options together in sendWebpage is risky. Your server might overwrite widget information in confusing ways. Be careful!')
    }

    // if live syncing, or client script is included, add the UI library bundle
    if (options.live || options.script) {
      body.headTags.push(html`<script defer id="ui-library" src="${req.baseUrl}/client-ui.js"></script>`)
      body.headTags.push(html`<script id="ui-serialized" type="text/x-json-sandals-serialized">${
        raw(Serialize.encode(body, false, 2))
      }</script>`)

      const startupCode = [
        '{',
        "  window.ui = require('ui')",
        "  window.__widgetData = ui.reconstitute(document.getElementById('ui-serialized').textContent)",
        '  document.body.replaceWith(__widgetData.root.render())',
        '  ui.webpage = __widgetData.root'
      ]

      if (options.live) {
        // update the widgets in to RPC mode
        body.liveAccessKey = crypto.randomBytes(32).toString('base64')
        body.live = false
        body.responseTimestamp = Date.now()
        body.sendRemoteQueue = []
        body.sendRemoteEvent = (data) => body.sendRemoteQueue.push(data)
        liveCallbacks.set(body, {})
        body.liveConnected = new Promise((resolve, reject) => {
          liveCallbacks.get(body).connect = { resolve, reject }
        })
        body.liveDisconnected = new Promise((resolve, reject) => {
          liveCallbacks.get(body).disconnect = { resolve, reject }
        })
        liveBodyCache[body.rpcID] = body
        // let every widget know what the body is for uplinking remote events
        body.listWidgets().forEach(widget => { widget.root = body })
        // add the code to enable RPC client side
        startupCode.push(`  ui.connectLive(__widgetData, ${JSON.stringify(body.liveAccessKey)})`)

        // garbage collect the live body cache after a delay so it has time to potentially expire
        setTimeout(() => cleanLiveBodyCache(), liveBodyCacheTimeout * 1.1)
      }
      startupCode.push('}')

      if (options.script) {
        startupCode.push('')
        startupCode.push('// user script code:')
        startupCode.push(options.script)
      }

      body.headTags.push(html`<script id="page-code"> window.addEventListener('DOMContentLoaded', () => { ${raw(startupCode.join('\n'))} }) </script>`)
    }

    res.send(ui.html(body, { baseUrl: req.baseUrl }))
    return body
  },

  // hook up this middleware to handle building client scripts
  // also handles live SSE syncing of widget updates from server to client
  clientScriptsMiddleware () {
    return (request, response, next) => {
      // ask if the client prefers text/html or event-stream content
      const requestType = request.accepts(['text/html', 'text/event-stream'])

      // if it's a "live" page request, hook that up
      if (requestType === 'text/event-stream' && request.query.pageID && request.query.liveAccessKey) {
        const body = liveBodyCache[request.query.pageID]
        const callbacks = liveCallbacks.get(body)
        delete liveBodyCache[request.query.pageID]
        liveCallbacks.delete(body)
        if (body && request.query.liveAccessKey === body.liveAccessKey) {
          const stream = new SSE()
          stream.pipe(response)

          body.live = true
          if (callbacks) callbacks.connect.resolve(request)

          body.sendRemoteEvent = (event) => stream.event(Serialize.encode(event))
          body.sendRemoteQueue.forEach(event => body.sendRemoteEvent(event))
          delete body.sendRemoteQueue

          response.on('close', () => {
            delete body.sendRemoteEvent
            body.live = false
            if (callbacks) callbacks.disconnect.resolve(request)
          })
        } else {
          // send error feed expired
          response.status(404).send('Error: Body Unavailable, cache expired')
        }

      } else {
        next()
      }
    }
  },

  // a tagged template literal function, to embed widgets and variables in to scripts sent to the client
  script (strings, ...embeds) {
    const output = strings.map((string, index) => {
      let embed = embeds[index]
      if (embed instanceof BasicWidget) {
        embed = `(__widgetData.widgets[${JSON.stringify(embed.rpcID)}])`
      } else {
        if (index < embeds.length - 1) {
          embed = JSON.stringify(embed)
        } else {
          embed = ''
        }
      }
      return `${string}${embed}`
    })

    const concat = output.join('').replace(/<\/script/gi, '</scr\\ipt')
    return raw(concat)
  }
}

module.exports = ServerTools
