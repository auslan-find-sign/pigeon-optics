const EventEmitter = require('events')
const codec = require('../models/codec')

exports.events = new EventEmitter()

// call this whenever a dataPath's contents change
exports.pathUpdated = function (dataPath, version) {
  const parsed = codec.path.decode(dataPath)
  exports.events.emit('change', {
    path: dataPath,
    ...parsed,
    version
  })
}

// do the initial broadcasts of all data paths when the server starts up
exports.bootBroadcast = async function () {
  const auth = require('../models/auth')
  const datasets = require('../models/dataset')
  const lenses = require('../models/lens')

  for await (const author of auth.iterate()) {
    for await (const dataset of datasets.iterate(author)) {
      const meta = await datasets.readMeta(author, dataset)
      exports.pathUpdated(codec.path.encode('datasets', author, dataset), meta.version)
    }

    for await (const lens of lenses.iterate(author)) {
      const meta = await lenses.readMeta(author, lens)
      exports.pathUpdated(codec.path.encode('lenses', author, lens), meta.version)
    }
  }

  exports.pathUpdated('/meta/system:system')
}
