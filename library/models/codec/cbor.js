const cbor = require('cbor-x')

exports.handles = ['application/cbor', 'application/x-cbor']
exports.extensions = ['cbor']
exports.decoderOpts = { structuredClone: false, useRecords: false }
exports.encoderOpts = { structuredClone: false, useRecords: false }

/**
 * Encodes a CBOR encodable object, with support for this application's Attachment and AttachmentReference objects
 * @param {any} data - arbitrary object to encode
 * @returns {Buffer} - cbor buffer
 */
exports.encode = function (data) {
  return cbor.encode(data)
}

/**
 * Decodes first item in buffer using CBOR, unpacking any attachments included in the cbor too
 * @param {Buffer} buffer - buffer containing cbor which optionally uses tag 27 object representation to include Attachment and AttachmentReference objects
 * @returns {any} - returns decoded object
 */
exports.decode = function (inputBuffer) {
  return cbor.decode(inputBuffer)
}

/**
 * Create a transform stream which transforms a buffer stream in to an object stream using cbor streaming decoding
 * @returns {import('stream').Transform}
 */
exports.decoder = function () {
  return new cbor.DecoderStream(exports.decoderOpts)
}

/**
 * Create a transform stream which transforms a readable object stream to a binary encoded stream
 * @returns {import('stream').Transform}
 */
exports.encoder = function () {
  return new cbor.EncoderStream(exports.encoderOpts)
}
