/**
 * Scratch File is a file you can append data to, and get back a function which
 * when called resolves with the object you originally wrote
 */
const tfq = require('tiny-function-queue')
const fs = require('fs').promises
const os = require('os')
const path = require('path')
const crypto = require('crypto')
const v8 = require('v8')

exports.ScratchFile = class ScratchFile {
  /**
   * Create a ScratchFile interface
   * @param {fs.FileHandle} fileRef
   * @param {string} id
   */
  constructor (fileRef, id) {
    this.ref = fileRef
    this.id = id
    this.length = 0
  }

  async write (object) {
    const encoded = v8.serialize(object)
    return await tfq.lockWhile(['scratch-file', this.id], async () => {
      const length = encoded.length
      const position = this.length
      this.length += length
      await this.ref.write(encoded, 0, length, position)

      const read = async () => {
        const buffer = Buffer.alloc(length)
        await tfq.lockWhile(['scratch-file', this.id], async () => {
          await this.ref.read(buffer, 0, length, position)
        })
        return v8.deserialize(buffer)
      }
      return read
    })
  }

  /**
   * close the scratch file, deleting it
   */
  async close () {
    this.ref.close()
    this.ref = undefined
  }
}

/**
 * create a new temporary scratch file, where objects can be temporarily written out
 * @returns {exports.ScratchFile}
 */
exports.file = async function createScratchFile () {
  const id = `scratch-file-${crypto.randomBytes(32).toString('hex')}.v8-scratch`
  const tempPath = path.join(os.tmpdir(), id)
  const fileRef = await fs.open(tempPath, 'wx+')
  await fs.unlink(tempPath)
  return new exports.ScratchFile(fileRef, id)
}
