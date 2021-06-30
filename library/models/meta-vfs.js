// a read-only model which provides a virtual filesystem (kind of like /dev on unix)
// so readPath can read information about the meta operations of Pigeon Optics for things like search
const auth = require('./auth')
const datasets = require('./dataset')
const lenses = require('./lens')
const itToArray = require('../utility/async-iterable-to-array')

const iterators = {
  authors: auth.iterate,

  datasets: async function * () {
    for await (const author of iterators.authors()) {
      for await (const name of datasets.iterate(author)) {
        yield {
          path: `/datasets/${author}:${name}/`,
          author,
          name
        }
      }
    }
  },

  lenses: async function * () {
    for await (const author of iterators.authors()) {
      for await (const name of lenses.iterate(author)) {
        yield {
          path: `/lenses/${author}:${name}/`,
          author,
          name
        }
      }
    }
  },

  stats: async function () {
    return {
      memory: process.memoryUsage(),
      cpu: process.cpuUsage(),
      uptime: process.uptime()
    }
  },

  settings: async function () {
    const { title, lensTimeout, lensCodeSize, maxRecordSize, maxAttachmentSize } = require('./settings')
    return { title, lensTimeout, lensCodeSize, maxRecordSize, maxAttachmentSize }
  },

  formats: async function () {
    const codecs = require('./codec')
    return {
      extensions: Object.keys(codecs.extensionHandlers),
      mediaTypes: Object.keys(codecs.mediaTypeHandlers)
    }
  }
}

exports.exists = (author, name, record) => {
  if (author !== 'system') return false
  if (name !== 'system') return false
  return !!iterators[record]
}

exports.readEntry = (author, name, record) => {
  if (author !== 'system') return undefined
  if (name !== 'system') return undefined
  const output = iterators[record]()
  if (output.next) {
    return itToArray(output)
  } else {
    return output
  }
}

exports.readEntryMeta = (author, name, record) => {
  return { version: Date.now(), hash: `${Date.now()}` }
}

exports.readEntryByHash = (author, name, hash) => {
  return exports.readEntry(author, name, hash)
}

exports.iterateEntries = async function * () {
  for (const key of Object.keys(iterators)) {
    yield key
  }
}

exports.listEntries = () => Object.keys(iterators)
