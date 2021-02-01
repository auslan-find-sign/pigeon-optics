/**
 * Attachment Storage is a content addressed store of data blobs, i.e. video files
 */
const fs = require('fs-extra')
const path = require('path')
const defaults = require('../../package.json').defaults
const { Attachment, AttachmentReference } = require('./attachment')
const { default: PQueue } = require('p-queue')
const writeQueue = new PQueue({ concurrency: 1 })

/**
 * Gets filesystem path to attachment, regardless if it exists
 * @param {string|Buffer|Attachment|AttachmentReference} hashOrAttachment - hash string or buffer, or an Attachment or AttachmentReference object
 * @returns {string} - local filesystem path
 */
module.exports.getPath = (hashOrAttachment) => {
  let hash
  if (Buffer.isBuffer(hashOrAttachment)) {
    hash = hashOrAttachment.toString('hex').toLowerCase()
  } else if (hashOrAttachment instanceof AttachmentReference) {
    hash = hashOrAttachment.hash.toString('hex').toLowerCase()
  } else if (typeof hashOrAttachment === 'string') {
    hash = hashOrAttachment.toLowerCase()
  } else {
    throw new Error('Invalid input')
  }

  return path.join(defaults.data, 'attachments', `${hash}`)
}

/**
 * Converts a hash and mimeType, or an AttachmentReference, in to an Attachment object with data loaded
 * @param {string|Buffer|Attachment|AttachmentReference} hash - hash string or buffer, or an Attachment or AttachmentReference object
 * @returns {Attachment} - returns an Attachment including data
 */
module.exports.read = async (hash, mimeType = 'application/octet-stream') => {
  if (hash instanceof Attachment) return hash
  if (hash instanceof AttachmentReference) mimeType = hash.mimeType
  const data = await fs.readFile(module.exports.getPath(hash))
  return new Attachment(data, mimeType)
}

/** Create or update a cbor data file, creating a .backup file of the previous version in the process
 * @param {Attachment} attachment - Attachment object containing data
 * @returns {AttachmentReference} - reference to the created attachment
 * @async
 */
module.exports.write = async (attachment) => {
  if (!(attachment instanceof Attachment)) throw new Error('argument must be an Attachment')
  const path = module.exports.getPath(attachment)
  if (!await fs.pathExists(path)) {
    await writeQueue.add(x => fs.writeFile(path, attachment.data))
  }
  return new AttachmentReference(attachment.hash, attachment.mimeType)
}

/** Remove a cbor data file
 * @param {string|Buffer|Attachment|AttachmentReference} attachment - hash or attachment to delete
 * @async
 */
module.exports.delete = async (attachment) => {
  await fs.remove(module.exports.getPath(attachment))
}

/**
 * Checks if an attachment exists in storage
 * @param {string|Buffer|Attachment|AttachmentReference} attachment - hash or attachment to delete
 * @async
 */
module.exports.exists = async (attachment) => {
  await fs.pathExists(module.exports.getPath(attachment))
}

/** List all the records in a data path
 * @returns {Buffer[]}
 * @async
 */
module.exports.list = async () => {
  const files = await fs.readdir(path.join(defaults.data, 'attachments'))
  return files.map(x => Buffer.from(x, 'hex'))
}

/**
 * takes a complex object, and converts any Attachments in to AttachmentReferences, writing them to disk
 * @param {Object|Array|Number|string|boolean|null|undefined} input - any input object/array/primitive
 * @async
 */
module.exports.storeAttachments = async (input) => {
  if (Array.isArray(input)) {
    return await Promise.all(input.map(x => module.exports.storeAttachments(x)))
  } else if (input instanceof Map) {
    const output = new Map()
    for (const [key, value] of input.entries()) output.set(key, await module.exports.storeAttachments(value))
    return output
  } else if (input instanceof Set) {
    const output = new Set()
    for (const value of input.values()) output.set(await module.exports.storeAttachments(value))
    return output
  } else if (input instanceof Attachment) {
    return await module.exports.write(input)
  } else if (input instanceof AttachmentReference) {
    return await input
  } else if (typeof input === 'object') {
    return Object.fromEntries(await Promise.all(Object.entries(input).map(async ([key, value]) => {
      return [key, await module.exports.storeAttachments(value)]
    })))
  }

  return input
}
