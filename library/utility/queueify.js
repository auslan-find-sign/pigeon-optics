// simple thing to avoid concurrent writes and reads clobbering stuff
const { default: PQueue } = require('p-queue')

// accepts an object, returns a proxy of it with prototype inheritance, where any async functions in the
// original object are replaced with function() wrapped queueified versions, but the functions themselves
// get their original this and don't incur queueing internally, and any non-async functions are bound to the
// non-queued object too
exports.object = function (object) {
  const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor

  const queue = new PQueue({ concurrency: 1 })
  const output = Object.create(object)
  for (const name in object) {
    if (typeof object[name] === 'function') {
      output[name] = object[name].bind(object)
      if (object[name].constructor === AsyncFunction) {
        output[name] = exports.function(output[name], queue)
      }
    }
  }

  return Object.freeze(output)
}

// wraps an async function with a thing that stops them from running concurrently
exports.function = function (fn, queue) {
  return async (...args) => await queue.add(async () => await fn(...args))
}
