/**
 * Attachment Storage is a content addressed store of data blobs, i.e. video files
 */
const { Attachment, AttachmentReference, listReferences } = require('./attachment')
const readPath = require('./read-path')
const crypto = require('crypto')
const { default: PQueue } = require('p-queue')
const metaQueue = new PQueue({ concurrency: 1 })

const blobStore = require('./file/blob').instance({
  extension: '.attachment-data',
  hash: (input) => {
    const digester = crypto.createHash('sha256')
    digester.update(input)
    return digester.digest()
  },
  rootPath: ['attachments', 'blobs']
})

const metaStore = require('./file/cbor')

/**
 * returns hash buffer for various inputs
 * @param {string|Buffer[32]|Attachment|AttachmentReference} input - whatever representation of attachment/hash
 * @returns {Buffer[32]}
 */
function inputToHash (input) {
  if (Buffer.isBuffer(input)) {
    return input
  } else if (input instanceof AttachmentReference) {
    return input.hash
  } else if (typeof input === 'string') {
    return Buffer.from(input, 'hex')
  } else {
    throw new Error('Invalid input')
  }
}

/**
 * Gets filesystem path to attachment, regardless if it exists
 * @param {string|Buffer|Attachment|AttachmentReference} hashOrAttachment - hash string or buffer, or an Attachment or AttachmentReference object
 * @returns {string} - local filesystem path
 */
exports.getBlobPath = function (hashOrAttachment) {
  const hash = inputToHash(hashOrAttachment)
  return blobStore.getPath(hash)
}

/**
 * Gets filesystem path to attachment meta info, regardless if it exists
 * @param {string|Buffer|Attachment|AttachmentReference} hashOrAttachment - hash string or buffer, or an Attachment or AttachmentReference object
 * @returns {string} - local filesystem path
 */
exports.getMetaPath = function (hashOrAttachment) {
  const hash = inputToHash(hashOrAttachment)
  return ['attachments', 'meta', hash]
}

/**
 * Converts a hash and mimeType, or an AttachmentReference, in to an Attachment object with data loaded
 * @param {string|Buffer|Attachment|AttachmentReference} hash - hash string or buffer, or an Attachment or AttachmentReference object
 * @returns {Attachment} - returns an Attachment including data
 */
exports.read = async function (hash, mimeType = 'application/octet-stream') {
  if (hash instanceof Attachment) return hash
  if (hash instanceof AttachmentReference) mimeType = hash.mimeType
  const data = await blobStore.read(hash)
  return new Attachment(data, mimeType)
}

exports.readMetadata = async function (input) {
  const name = inputToHash(input).toString('hex')
  return await metaStore.read(['attachments', 'meta', name])
}

/** Create or update a cbor data file, creating a .backup file of the previous version in the process
 * @param {string} dataPath - dataPath to entry which is storing this attachment, to link up for pruning later
 * @param {Attachment|Buffer} data - Attachment object containing data, or a buffer of data
 * @returns {AttachmentReference|Buffer[32]} - if an Attachment is input, AttachmentReference is returned, if a Buffer is input, a hash Buffer is returned
 * @async
 */
exports.write = async function (dataPath, data) {
  let buffer = data
  if (data instanceof Attachment) {
    buffer = data.data
  }
  if (!Buffer.isBuffer(buffer)) {
    throw new Error('data must be an Attachment or a Buffer')
  }

  // write blob out (underlying blob storage only writes if it doesn't exist already)
  const hash = await blobStore.write(buffer)

  await metaQueue.add(async () => {
    const metaPath = ['attachments', 'meta', hash.toString('hex')]
    const metadata = {
      created: Date.now(),
      hash,
      linkers: []
    }

    // try to load existing metadata
    if (await metaStore.exists(metaPath)) {
      Object.assign(metadata, await metaStore.read(metaPath))
    }

    if (!metadata.linkers.includes(dataPath)) {
      metadata.updated = Date.now()
      metadata.linkers.push(dataPath)
      await metaStore.write(metaPath, metadata)
    }
  })

  if (data instanceof Attachment) {
    return new AttachmentReference(hash, data.mimeType)
  } else {
    return hash
  }
}

/** Remove a cbor data file
 * @param {string|Buffer|Attachment|AttachmentReference} attachment - hash or attachment to delete
 * @async
 */
exports.delete = async (attachment) => {
  await metaQueue.add(async () => {
    const hash = inputToHash(attachment)
    await metaStore.delete(['attachments', 'meta', hash.toString('hex')])
    await blobStore.delete(hash)
  })
}

/**
 * Checks if an attachment exists in storage
 * @param {string|Buffer|Attachment|AttachmentReference} attachment - hash or attachment to delete
 * @async
 */
exports.exists = async (attachment) => {
  const hash = inputToHash(attachment)
  await metaStore.exists(['attachments', 'meta', hash.toString('hex')])
}

/**
 * takes a complex object, and converts any Attachments in to AttachmentReferences, writing them to disk
 * @param {string} dataPath - path where data will later exist which contains this attachment
 * @param {Object|Array|Number|string|boolean|null|undefined} input - any input object/array/primitive
 * @async
 */
exports.storeAttachments = async (dataPath, input) => {
  if (Array.isArray(input)) {
    return await Promise.all(input.map(x => exports.storeAttachments(dataPath, x)))
  } else if (input instanceof Map) {
    const output = new Map()
    for (const [key, value] of input.entries()) output.set(key, await exports.storeAttachments(dataPath, value))
    return output
  } else if (input instanceof Set) {
    const output = new Set()
    for (const value of input.values()) output.set(await exports.storeAttachments(dataPath, value))
    return output
  } else if (input instanceof Attachment) {
    return await exports.write(dataPath, input)
  } else if (input instanceof AttachmentReference) {
    return await input
  } else if (typeof input === 'object' && input !== null /* I hate you */) {
    return Object.fromEntries(await Promise.all(Object.entries(input).map(async ([key, value]) => {
      return [key, await exports.storeAttachments(dataPath, value)]
    })))
  }

  return input
}

/** look at attachment with specific hash, and prune it if it has no live references and hasn't
 * been updated or created in the past 30 minutes
 * @param {string|Buffer|Attachment|AttachmentReference} input - hash or attachment to delete
 */
exports.prune = async (input) => {
  const meta = await exports.readMetadata(input)

  if (meta) {
    console.info(`trying to prune attachment ${meta.hash.toString('hex')}`)
    for (const linkerPath of meta.linkers) {
      for await (const { data } of readPath(linkerPath)) {
        const attachRefs = listReferences(data)
        if (attachRefs.some(ar => ar.hash.equals(meta.hash))) {
          console.info(`prune ${input} still in use at ${linkerPath}, retaining attachment blob`)
          return
        }
      }
    }

    const prev30Mins = Date.now() - 1000 * 60 * 30
    if (meta.created > prev30Mins) {
      console.info('keeping blob, it was created less than 30 minutes ago')
      return
    }

    if (meta.updated > prev30Mins) {
      console.info('keeping blob, it was used less than 30 minutes ago')
      return
    }

    // if we got to here, none of the linkers actually reference this attachment, ditch it
    console.info('no reason to keep it, deleting')
    await exports.delete(input)
  }
}

// chooses a random attachment blob to investigate and potentially prune
// call this at an interval to slowly casually do the background work of pruning old data
exports.pruneRandom = async () => {
  const list = await metaStore.list(['attachments', 'meta'])
  if (list.length > 0) {
    const choice = list[Math.round(Math.random() * (list.length - 1))]
    return await exports.prune(choice)
  }
}
