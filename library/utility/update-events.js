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

  for await (const user of auth.iterateUsers()) {
    for await (const dataset of datasets.iterate(user)) {
      exports.pathUpdated(codec.path.encode('datasets', user, dataset))
    }

    for await (const lens of lenses.iterate(user)) {
      exports.pathUpdated(codec.path.encode('lenses', user, lens))
    }
  }

  exports.pathUpdated('/meta/system:system')
}
