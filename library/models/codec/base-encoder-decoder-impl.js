const streams = require('stream')
const nullSymbol = Symbol.for('null')

/**
 * Creates a Transform/Duplex stream, which encodes any objects written to it
 * @param {object} [options]
 * @param {boolean} [options.wrap = false] - input values are wrapped in a { value } object to better support null values
 * @returns {import('stream').Duplex}
 */
exports.encoder = function (options = {}) {
  const objects = new streams.PassThrough({ objectMode: true })
  const self = this
  let iter

  const duplex = new streams.Duplex({
    readableObjectMode: false,
    writableObjectMode: true,
    async read () {
      try {
        if (iter === undefined) {
          async function * iterFeed () {
            for await (const value of objects) yield value === nullSymbol ? null : value
          }
          iter = self.iteratorToStream(iterFeed(), options)
        }

        for await (const value of iter) {
          const morePlz = this.push(value)
          if (!morePlz) return
        }
        this.push(null)
      } catch (err) {
        this.destroy(err)
      }
    },
    write (value, enc, cb) {
      if (value === nullSymbol) value = null
      else if (options.wrap) value = value.value
      objects.write(value === null ? nullSymbol : value, enc, cb)
    },
    final (cb) { objects.end(cb) }
  })

  objects.on('error', err => duplex.destroy(err))

  return duplex
}

/**
 * Creates a Transform/Duplex stream, which decodes buffers in to a series of objects, optionally wrapped
 * @param {object} [options]
 * @param {boolean} [options.wrap = false] - input values are wrapped in a { value } object to better support null values
 * @returns {import('stream').Duplex}
 */
exports.decoder = function (options = {}) {
  const buffers = new streams.PassThrough({ objectMode: false })
  const self = this
  let iter

  const duplex = new streams.Duplex({
    readableObjectMode: true,
    writableObjectMode: false,
    async read () {
      try {
        if (!iter) iter = await self.streamToIterator(buffers, options)

        for await (const value of iter) {
          const morePlz = this.push(options.wrap ? { value } : (value === null ? nullSymbol : value))
          if (!morePlz) return
        }
        this.push(null)
      } catch (err) {
        this.destroy(err)
      }
    },
    write (chunk, enc, cb) { buffers.write(chunk, enc, cb) },
    final (cb) { buffers.end(cb) }
  })

  buffers.on('drain', () => duplex.emit('drain'))
  buffers.on('error', err => duplex.destroy(err))

  return duplex
}
