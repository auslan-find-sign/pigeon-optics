// simple thing to avoid concurrent writes and reads clobbering stuff
const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor
const { default: PQueue } = require('p-queue')

// const unqueueifyPropertyName = `__unqueueify_link_${Math.round(Math.random() * 0xFFFFFF).toString(26)}`
const unqueueifyPropertyName = Symbol('unqueueify-link')

// accepts an object, returns a proxy of it with prototype inheritance, where any async functions in the
// original object are replaced with function() wrapped queueified versions, but the functions themselves
// get their original this and don't incur queueing internally, and any non-async functions are bound to the
// non-queued object too
exports.object = function (object) {
  const queue = new PQueue({ concurrency: 1 })
  const output = Object.create(object)

  for (const name in object) {
    if (typeof object[name] === 'function') {
      output[name] = exports.function(object[name], object, queue)
    }
  }

  output[unqueueifyPropertyName] = object
  return output
}

// wraps an async function with a thing that stops them from running concurrently
exports.function = function (fn, bind, queue) {
  let wrapped
  if (fn.constructor === AsyncFunction) {
    wrapped = async function QueueifyWrapper (...args) {
      return await queue.add(async () => await fn.call(bind, ...args))
    }
  } else {
    wrapped = fn.bind(bind)
  }

  wrapped[unqueueifyPropertyName] = fn
  return wrapped
}

// something that's been queueified, when passed in to this, becomes unqueueified
exports.unqueue = function (input) {
  return input[unqueueifyPropertyName]
}
