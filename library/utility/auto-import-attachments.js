const attachments = require('../models/attachments')
const missingAttachmentsError = require('./missing-attachments-error')
const recordStructure = require('./record-structure')

/**
 * Automatically import referenced attachments included with API/web request, and throw errors for missing attachments
 * @param {Request} req - express request
 * @param {string} destination - dataPath to record which will link to these attachments
 * @param {*} recordData - recordData, to detect links from
 * @returns {*} - recordData, with any file:/// urls transformed in to attachment hash:// links if possible
 */
module.exports = async function autoImportAttachments (req, destination, recordData) {
  const data = recordStructure.resolveContentIDs(recordData, req.filesByName)
  const links = recordStructure.listHashURLs(data)
  const missing = new Set()

  for (const link of links) {
    const hexhash = link.hash.toString('hex')
    const file = req.filesByHash[hexhash]
    if (file) {
      await attachments.import(file, { linkers: [destination] })
    } else {
      if (!await attachments.has(link.hash)) {
        missing.push(link.toString())
      }
    }
  }

  if (missing.length > 0) {
    throw missingAttachmentsError([...missing])
  } else {
    return data
  }
}
