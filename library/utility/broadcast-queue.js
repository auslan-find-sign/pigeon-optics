/**
 * a queue of messages which are fed out via async generators to each of the subscribers
 * this is used to notify derived datasets like js lenses and remote workers of changes to entries
 * of datasets or derived datasets, so they can react and update their views, and potentially
 * to provide an event-stream of realtime changes to web observers
 */
const { Readable } = require('stream')

class BroadcastQueue {
  constructor () {
    /** @type {Readable[]} */
    this.outputs = []
  }

  /**
   * Get a readable stream of broadcast objects
   * @returns {Readable}
   */
  getReadableStream () {
    const stream = new Readable({})
    this.outputs.push(stream)
    stream.on('close', () => {
      this.outputs = this.outputs.filter(x => x !== stream)
    })
    return stream
  }

  /**
   * push a new message in to all the streams
   * @param {any} message - any arbitrary object except for null
   */
  push (message) {
    this.outputs = this.outputs.filter(x => !x.destroyed)
    for (const stream of this.outputs) {
      stream.push(message)
    }
  }

  /**
   * destroy the readable streams
   */
  destroy () {
    this.push(null)
    this.outputs = []
  }
}

module.exports = BroadcastQueue
