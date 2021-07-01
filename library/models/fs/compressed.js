const zlib = require('zlib')
const { FSRaw } = require('./raw')
// const { transform: toTransform } = require('stream-to-it')
const { pipeline } = require('streaming-iterables')

// workaround for streaming-iterables.transform not carrying through errors well
// see: https://github.com/alanshaw/stream-to-it/issues/14
const toDuplex = require('stream-to-it/duplex')
const toTransform = (transform) => async function * (source) {
  const duplex = toDuplex(transform)
  // In a transform the sink and source are connected, an error in the sink
  // will be thrown in the source also. Catch the sink error to avoid unhandled
  // rejections and yield from the source.

  let error
  const sinkPromise = duplex.sink(source).catch(err => { error = err })

  for await (const val of duplex.source) {
    if (error) {
      if (transform.destroy) transform.destroy()
      if (duplex.source.return) duplex.source.return()
      throw error
    } else {
      yield val
    }
  }
  if (error) throw error
  await sinkPromise
  if (error) throw error
}

const BrotliOptions = {
  chunkSize: 32 * 1024,
  params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 5 }
}

class FSCompressedRaw extends FSRaw {
  readIter (...args) {
    const reader = super.readIter(...args)
    return toTransform(zlib.createBrotliDecompress(BrotliOptions))(reader)
  }

  writeIter (path, iterable) {
    return pipeline(
      () => iterable,

      // compress
      toTransform(zlib.createBrotliCompress(BrotliOptions)),

      // write out data to underlying file
      (iter) => super.writeIter(path, iter)
    )
  }
}

module.exports = new FSCompressedRaw([], '.raw.br')
module.exports.FSCompressedRaw = FSCompressedRaw
