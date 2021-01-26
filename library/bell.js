// Bell is a simple class by Phoenix @bluebie
// an instance of bell can be rung, and provides a promise which resolves when the bell is rung
// once rung, the bell provides another promise which will resolve the next time it's rung
// the promise never rejects
// 
// The usefulness of Bell is to allow anyone with a reference to it, to ring it, notifying everyone
// else who was waiting for it to ring, that something happened, so you can think of a bell as being
// like an event. Useful for notifying loops that some data has changed, i.e. re-render a live webpage
// when underlying data was modified
// 
// Usage:
// let bell = new Bell()
// elsewhere: await bell.ringing
// bell.ring()
// and `await bell.ringing` will return whatever argument was given to bell.ring(arg)

const bellResolves = new WeakMap()

class Bell {
  constructor () {
    this.reset()
  }
  
  reset () {
    this.ringing = new Promise((resolve, reject) => bellResolves.set(this, resolve))
  }
  
  ring (argument) {
    const resolve = bellResolves.get(this)
    this.reset()
    resolve(argument)
  }
}

module.exports = Bell