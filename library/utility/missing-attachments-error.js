const createHttpError = require('http-errors')

/**
 * Creates a HTTP error with included headers for asking clients to retry with attachments included
 * @param {string[]|URL[]} hashURLs an array of hash URLs, either strings or URL objects
 * @returns {createHttpError.HttpError}
 */
module.exports = function createMissingAttachmentsError (hashURLs) {
  return createHttpError(400, 'Missing Attachments', {
    headers: {
      'X-Pigeon-Optics-Resend-With-Attachments': hashURLs.map(x => JSON.stringify(x.toString())).join(', ')
    }
  })
}
