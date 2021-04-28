const streams = require('stream')
const xmlEnc = require('pigeonmark-xml/library/encode')
const arbEnc = require('pigeonmark-arbitrary/library/encode')
const pmark = require('pigeonmark-utils')

// speciality encoder for building xml flat file exports
module.exports = function entriesEncoder () {
  let first = true

  return new streams.Transform({
    writableObjectMode: true,
    transform: (chunk, encoding, callback) => {
      try {
        let { id, data, hash, version } = chunk
        if (!pmark.isPigeonMark(data)) data = arbEnc(data)
        const entry = ['record', { hash: hash.toString('hex'), version: version.toString(), id }, data]
        const xmlString = xmlEnc(entry)
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
