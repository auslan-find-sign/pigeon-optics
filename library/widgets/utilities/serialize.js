const raw = require('nanohtml/raw')
const action = require('./action')
const StyleObject = require('@bluebie/style-object')

const Serialize = {
  // encodes a mix of BasicWidgets, nanohtml strings, and plain json-compatible objects
  // optional argument stub can be:
  //  - false: everything is fully included, suitable for deep clone or initial transmission to a client that has no state
  //  - true: all widgets are stubbed except the outermost one, suitable for diff generation
  //  - [array]: a list of widgets that should be stubbed
  // if indent is provided, output will be pretty printed with that many spaces indentation
  encode (data, stub = false, indent = undefined) {
    return JSON.stringify(data, (key, value) => {
      if (value === null) {
        return null
        
      } else if (value === undefined) {
        return undefined
        
      } else if (typeof value === 'object' && value.getConstructorOptions) {
        // serialize a Basic Widget
        if (stub === true || (Array.isArray(stub) && stub.find(x => x.rpcID === value.rpcID))) {
          // previous version of this widget exists and matches, so we can just reference it
          return { __widget: value.rpcID }
        } else {
          // otherwise, put the widget constructor in here
          return { __widget: value.rpcID, type: value.constructor.name, opts: value.getConstructorOptions() }
        }
        
      } else if (value instanceof String && value.__encoded === true) {
        // serialize a tagged raw html string from nanohtml
        return { __html: `${value}` }
        
      } else if (action.isAction(value)) {
        // serialize a UI action
        return { __action: action.getConstructor(value) }
        
      } else {
        return value
      }
    }, indent)
  },
  
  // decodes an encode produced by this, producing widgets, nanohtml strings, and plain JSON structure
  // if widgetConstructors is provided, it should be an array of widget classes
  // if existingWidgets is provided, decoder will attempt to find existing instances and use those
  decode (data, widgetConstructors = [], existingWidgets = []) {
    return JSON.parse(data, (key, value) => {
      if (value === null) {
        return null
        
      } else if (value === undefined) {
        return undefined
        
      } else if (typeof value === 'object' && typeof value.__widget === 'string') {
        // try to find this widget locally, if we already have it, just return that
        const existingWidget = existingWidgets.find(x => x.rpcID === value.__widget)
        if (existingWidget) {
          return existingWidget
        }
        // try to find a widget constructor of the same type and create the widget locally as a clone
        const FoundWidget = widgetConstructors.find(x => x.name === value.type)
        if (FoundWidget) {
          const widget = new FoundWidget(value.opts)
          widget.rpcID = value.__widget
          return widget
        }
        throw new Error(`serialized data contains widget of type "${value.type}" but local version isn't available`)
        
      } else if (typeof value === 'object' && typeof value.__html === 'string') {
        // nanohtml string type
        return raw(value.__html)
        
      } else if (typeof value === 'object' && value.__action) {
        // ui action type
        return action(...(value.__action))
      }
      return value
    })
  },
  
  // make a shallow or deep clone of a widget
  // shallow clones, if they contain any other widgets, will reference those widgets directly
  // deep clones, if they contain any other widgets, will have clones of those widgets too
  clone (input, deep = false) {
    if (deep === true) {
      const constructors = input.listWidgets().map(x => x.constructor)
      const encoded = Serialize.encode(input, false)
      return Serialize.decode(encoded, constructors)
    } else {
      const referenceWidgets = input.listWidgets().filter(x => x !== input)
      const encoded = Serialize.encode(input, referenceWidgets)
      return Serialize.decode(encoded, [input.constructor], referenceWidgets)
    }
  }
}

module.exports = Serialize