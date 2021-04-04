/**
 * Attachment Storage is a content addressed store of data blobs, i.e. video files
 */
const assert = require('assert')
const readPath = require('./read-path')

const blobStore = require('./file/blob').instance({
  extension: '.data',
  rootPath: ['attachments', 'blobs']
})

const metaStore = require('./file/cbor').instance({
  rootPath: ['attachments', 'meta']
})

/**
 * Get a local filesystem path to the blob data of the attachment content hash
 * Note: this does not validate the content exists
 * @param {Buffer|string} hash
 * @returns {string} local filesystem path
 */
exports.getPath = function (hash) {
  if (typeof hash === 'string') hash = Buffer.from(hash, 'hex')
  assert(Buffer.isBuffer(hash), 'hash argument must be a buffer or hex string')

  return blobStore.getPath(hash)
}

/**
 * Write a stream of arbitrary data to the attachment store
 * @param {Readable} stream Readable stream to write to attachment store
 * @param {object} meta metadata object, importantly containing linkers array
 * @async
 */
exports.writeStream = async function (stream, meta) {
  assert(meta && typeof meta === 'object', 'meta argument must be an object')
  assert(Array.isArray(meta.linkers), 'meta object must contain a linkers property which is an array')

  const hash = await blobStore.writeStream(stream)
  await metaStore.update([hash.toString('hex')], oldValue => {
    return {
      created: Date.now(),
      ...oldValue || {},
      updated: Date.now(),
      ...meta,
      linkers: [...new Set([...(oldValue || {}).linkers || [], ...meta.linkers])]
    }
  })
  return hash
}

/**
 * Read an attachment's contents as a stream
 * @param {Buffer|string} hash - content hash of the attachment to read
 * @returns {Readable}
 * @async
 */
exports.readStream = async function (hash) {
  if (typeof hash === 'string') hash = Buffer.from(hash, 'hex')
  assert(Buffer.isBuffer(hash), 'hash argument must be a buffer or hex string')

  return blobStore.readStream(hash)
}

/**
 * Read metadata object of an attachment, notably containing linkers array, and ms epoch created and updated timestamps
 * @param {Buffer|string} hash
 * @returns {object}
 * @async
 */
exports.readMeta = async function (hash) {
  if (typeof hash === 'string') hash = Buffer.from(hash, 'hex')
  assert(Buffer.isBuffer(hash), 'hash argument must be a buffer or hex string')

  return await metaStore.read([hash.toString('hex')])
}

/**
 * check if attachment store has the requested item
 * @param {Buffer|string} hash
 * @returns {boolean}
 * @async
 */
exports.has = async function (hash) {
  if (typeof hash === 'string') hash = Buffer.from(hash, 'hex')
  assert(Buffer.isBuffer(hash), 'hash argument must be a buffer or hex string')

  return await blobStore.exists(hash)
}

/**
 * validate an attachment, pruning dead linkers and deleting attachment if it's no longer linked to
 * updating the attachment's metadata, pruning any linkers values that aren't correct
 * @param {Buffer|string} hash
 * @returns {boolean} - true if the attachment remains in storage, false if it was removed
 * @async
 */
exports.validate = async function (hash) {
  if (typeof hash === 'string') hash = Buffer.from(hash, 'hex')
  assert(Buffer.isBuffer(hash), 'hash argument must be a buffer or hex string')

  let retain = false
  await metaStore.update([hash.toString('hex')], async meta => {
    if (meta === undefined) {
      return undefined // the attachment doesn't even exist. whatever
    } else {
      const newLinkers = []
      const hashPath = `/${hash.toString('hex').toLowerCase()}`
      for await (const { path, links } of readPath.meta(meta.linkers)) {
        if (links && Array.isArray(links)) {
          for (const link of links) {
            const linkURL = new URL(link)
            if (linkURL.protocol.toLowerCase() === 'hash:' && linkURL.host.toLowerCase() === 'sha256') {
              if (linkURL.pathname.toLowerCase() === hashPath) {
                newLinkers.push(path)
              }
            }
          }
        }
      }

      if (newLinkers.length > 0) retain = true
      return {
        ...meta,
        linkers: newLinkers
      }
    }
  })

  // if we found valid linkers, keep the attachment
  if (!retain) {
    await Promise.all([
      blobStore.delete(hash),
      metaStore.delete([hash.toString('hex')])
    ])
  }

  return retain
}
