const streams = require('stream')
const json = require('./json')

exports.handles = ['ndjson', 'jsonlines'].flatMap(x => [`application/${x}`, `text/${x}`, `application/x-${x}`, `text/x-${x}`])
exports.extensions = ['jsonl']

exports.encode = function (object) {
  if (object && typeof object === 'object') {
    if (object[Symbol.iterator]) {
      const out = []
      for (const item of object) {
        out.push(json.encode(item) + '\n')
      }
      return out.join('')
    } else {
      return this.encode(Object.entries(object))
    }
  } else {
    return json.encode(object) + '\n'
  }
}

exports.decode = function (input) {
  if (Buffer.isBuffer(input)) input = input.toString('utf-8')
  return input.split('\n').map(x => x.trim()).filter(x => x.length > 0).map(x => json.decode(x))
}

const encImpl = require('./base-encoder-decoder-impl')
exports.encoder = encImpl.encoder.bind(exports)
exports.decoder = encImpl.decoder.bind(exports)

exports.encodeIterable = function encodeIterable (iterable) {
  async function * gen () {
    for await (const item of iterable) yield Buffer.from(`${json.encode(item)}\n`, 'utf-8')
  }
  return streams.Readable.from(gen(), { objectMode: false })
}

exports.decodeStream = async function * decodeStream (readable) {
  let buff = Buffer.alloc(0)
  for await (const chunk of readable) {
    buff = Buffer.concat([buff, chunk])
    let nlIndex
    while ((nlIndex = buff.indexOf('\n')) >= 0) {
      const lineSlice = buff.slice(0, nlIndex)
      const jsonString = lineSlice.toString('utf-8')
      buff = buff.slice(nlIndex + 1)
      yield json.decode(jsonString)
    }
  }
}
