const streams = require('stream')
const arbitraryNS = 'pigeon-optics:arbitrary'
const expandElement = require('./expand-element')
const isJsonML = require('./is-jsonml')
const arbitraryObjectToJsonML = require('./arbitrary-to-jsonml')
const encode = require('./encode')

// speciality encoder for building xml flat file exports
module.exports = function entriesEncoder () {
  let first = true

  return new streams.Transform({
    writableObjectMode: true,
    transform: (chunk, encoding, callback) => {
      try {
        let { id, data, hash, version } = chunk
        if (!isJsonML(data)) {
          data = expandElement(arbitraryObjectToJsonML(data))
          data[1].xmlns = arbitraryNS
        }
        const entry = {
          JsonML: ['record', { hash: hash.toString('hex'), version: version.toString(), id }, data]
        }
        const xmlString = encode(entry)
        if (first) {
          callback(null, Buffer.from(`<export xmlns="pigeon-optics:export">\n${xmlString}\n`, 'utf-8'))
          first = false
        } else {
          callback(null, Buffer.from(`${xmlString}\n`, 'utf-8'))
        }
      } catch (err) {
        callback(err)
      }
    },
    flush (callback) {
      callback(null, Buffer.from('</export>\n', 'utf-8'))
    }
  })
}
