const EventEmitter = require('events')
const codec = require('../models/codec')

exports.events = new EventEmitter()

// call this whenever a dataPath's contents change
exports.pathUpdated = function (dataPath) {
  const parsed = codec.path.decode(dataPath)
  exports.events.emit('change', {
    path: dataPath,
    ...parsed
  })
}

// do the initial broadcasts of all data paths when the server starts up
exports.bootBroadcast = async function () {
  const auth = require('../models/auth')
  const datasets = require('../models/dataset')
  const lenses = require('../models/lens')

  for await (const username of auth.iterateUsers()) {
    for await (const dataset of datasets.iterate()) {
      exports.pathUpdated(codec.path.encode('datasets', username, dataset))
    }

    for await (const lens of lenses.iterate()) {
      exports.pathUpdated(codec.path.encode('lenses', username, lens))
    }
  }

  exports.pathUpdated('/meta/system:system')
}
