const ui = require('../../ui')

const actionStore = new WeakMap()

const action = (name, ...args) => {
  if (action.registry[name]) {
    let handler = action.registry[name](...args)
    actionStore.set(handler, [name, ...args])
    return handler
  } else {
    throw new Error('Unknown action. Check the name is exactly right')
  }
}

action.isAction = (func) => {
  return actionStore.has(func)
}

action.getConstructor = (func) => {
  return actionStore.get(func)
}

action.registry = {}
action.register = (name, builder) => {
  action.registry[name] = builder
}

// action('get', '/url/path') will cause whatever it's assigned to,
// to make a GET http request to the url provided. If the URL returns
// json, it will be checked for patchList and actionList properties and
// if they exist, they'll automatically be applied to update the page
action.register('get', (url) => {
  return async () => {
    const request = await window.fetch(url)
    const response = await request.json()
    if (typeof response === 'object' && (response.patchList || response.actionList)) {
      ui.implementRPC(window.__widgetData.root, response)
    } else {
      console.warn('get action recieved a confusing json response', response)
    }
  }
})

// action('post-form', '/url/path') can be used with onSubmit on forms,
// it will send a POST http request as if the form was submitted in the normal way
// without navigating the page, and if the response is json and includes patchList
// or actionList properties, they'll be applied
action.register('post-form', (url = null) => {
  return async (event) => {
    event.preventDefault()
    const form = event.currentTarget
    const formData = new FormData(form)
    const searchParams = new URLSearchParams(formData)
    const request = await fetch(url || form.action, { method: 'POST', body: searchParams })
    const response = await request.json()
    if (typeof response === 'object' && (response.patchList || response.actionList)) {
      ui.implementRPC(window.__widgetData.root, response)
    } else {
      console.warn('get action recieved a confusing json response', response)
    }
  }
})

// action('alert', 'text for message') creates an alert box in the browser
action.register('alert', (message) => {
  return () => {
    window.alert(message)
  }
})

// action('redirect', '/url/path') causes the browser to navigate to a new URL
action.register('redirect', (url) => {
  return () => {
    window.location.href = url
  }
})

module.exports = action