const streams = require('stream')
const encode = require('./encode')

module.exports = function encoder () {
  let first = true

  return new streams.Transform({
    writableObjectMode: true,
    transform: (chunk, encoding, callback) => {
      try {
        const xmlString = encode(chunk)
        if (first) {
          callback(null, Buffer.from(`<array>\n${xmlString}\n`, 'utf-8'))
          first = false
        } else {
          callback(null, Buffer.from(`${xmlString}\n`, 'utf-8'))
        }
      } catch (err) {
        callback(err)
      }
    },
    flush (callback) {
      callback(null, Buffer.from('</array>\n', 'utf-8'))
    }
  })
}
