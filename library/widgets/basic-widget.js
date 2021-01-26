// An extended version of nanocomponent, with some extra defaults to make it easier to use
const Nanocomponent = require('nanocomponent')
const raw = require('nanohtml/raw')
const { paramCase } = require('param-case')
const diffWidgets = require('./utilities/diff-widgets')
const Serialize = require('./utilities/serialize')
const uniqueID = require('./utilities/unique-id')

const rpcCache = new WeakMap()

class BasicWidget extends Nanocomponent {
  constructor () {
    super()
    
    // create an rpcID code with roughly a uint64 of randomness
    this.rpcID = uniqueID()
    
    // set a useful property which suggests a css class name based on the name of the widget in javascript
    // paramCase transforms a name like CardSpread in to card-spread
    this.className = paramCase(this.constructor.name)
  }
  
  // Decide if createElement should be called to recreate the element if data changed
  // This is just an optimisation, so by default, we'll always update. We don't need the
  // performance boost of checking.
  update () {
    return true
  }
  
  // rpc takes a function, which is given a version of the widget you can make changes to
  // and after the function finishes running, the updates will be sent to the user
  rpc (func) {
    if (!this.root || typeof this.root.sendRemoteEvent !== 'function') {
      throw new Error('This widget hasn’t been sent in a webpage yet, so .rpc() is unavailable')
    }
    
    // if user supplied a callback, run it and give it the widget object to manipulate
    if (typeof func === 'function') func(this)
    
    // transmit to user
    const data = {
      patchList: this.getRPCPatch()
    }
    
    console.info('RPC out', Serialize.encode(data))
    // send it out to the sse channel
    this.root.sendRemoteEvent(data)
  }
  
  // makes a copy of this widget
  // a shallow clone reuses any children widgets, they aren't cloned
  // a deep clone replaces any children with copies too, so the full tree is seperate
  clone (deep = false) {
    return Serialize.clone(this, deep)
  }
  
  getConstructorOptions () {
    console.warn(`${this.constructor.name} doesn't implement getConstructorOptions()`)
    return {}
  }
  
  render (...args) {
    rpcCache.set(this, this.clone(false))
    return super.render(...args)
  }
  
  // returns a patch of what's changed since the widget was last rendered or last call to getRPCPatch
  getRPCPatch () {
    let backup = rpcCache.get(this)
    if (!backup) {
      backup = new this.constructor({})
    }
    
    rpcCache.set(this, Serialize.clone(this))
    const beforeList = backup.listWidgets()
    const afterList = this.listWidgets()
    return diffWidgets(beforeList, afterList)
  }
  
  // recieves JSON Merge Patch updates and applies them to this widget
  mergeRPCUpdate (patch) {
    const getPath = (obj, path) => path.length === 0 ? obj : getPath(obj[path[0]], path.slice(1))
    const setPath = (obj, path, value) => getPath(obj, path.slice(0, -1))[path[path.length - 1]] = value
    
    patch.forEach(([task, keypath, ...args]) => {
      if (task === 'dp') {
        // delete property - delete property at keypath
        delete getPath(this, keypath.slice(0, -1))[keypath.length - 1]
        
      } else if (task === 'sp') {
        // set property - first argument is new value of property at keypath
        setPath(this, keypath, args[0])
        
      } else if (task === 'af') {
        // array filter - args is a list of indexes to exclude
        const arr = getPath(this, keypath)
        setPath(this, keypath, arr.filter((x, idx) => !args.includes(idx)))
        
      } else if (task === 'ap') {
        // array push - args get appended to array
        getPath(this, keypath).push(...args)
        
      } else if (task === 'ar') {
        // array resort - each pair of args are numbers, containing previous index and new index
        const prev = [...getPath(this, keypath)]
        const build = []
        const pairs = []
        while (args.length > 0) {
          pairs.push([args.shift(), args.shift()])
        }
        prev.forEach((value, index) => {
          const find = pairs.find(x => x[1] === index)
          if (find) {
            build.push(prev[find[0]])
          } else {
            build.push(prev[index])
          }
        })
        setPath(this, keypath, build)
        
      } else {
        throw new Error(`Unknown widget patch task "${task}"!`)
      }
    })
  }
  
  // returns an array of this widget and all it's descendent widgets
  listWidgets () {
    const collection = []
    // explore the whole tree of things it contains, finding more widgets
    const collect = (input) => {
      if (!input) {
        return
      } else if (input instanceof BasicWidget) {
        collection.push(input)
        collect(input.getConstructorOptions())
      } else if (Array.isArray(input)) {
        input.forEach(collect)
      } else if (typeof input === 'object' && !(input instanceof String)) {
        collect(Object.values(input))
      }
    }
    
    collect(this)
    
    return collection
  }
  
  // test if the argument is a widget with all the same attributes as this one
  // this is a shallow equality test, it doesn't compare children widgets state, just that they're the same instances
  // in the same order
  shallowEquals (arg) {
    if (typeof arg === 'object' && 'getConstructorOptions' in arg) {
      return Serialize.encode(this, true) === Serialize.encode(arg, true)
    }
    
    return false
  }
}

// custom display when console.log is used with these on the server
if (typeof window === 'undefined') {
  const util = require('util')
  BasicWidget.prototype[util.inspect.custom] = function (depth, opts) {
    return `[Widget<${this.constructor.name}> ${this.rpcID}]`
  }
}

module.exports = BasicWidget