const cbor = require('cbor-x')
const { Readable } = require('stream')

exports.handles = ['application/cbor', 'application/x-cbor']
exports.extensions = ['cbor']
exports.decoderOpts = { structuredClone: false, useRecords: false, variableMapSize: true, useTag259ForMaps: true }
exports.encoderOpts = { structuredClone: false, useRecords: false, variableMapSize: true, useTag259ForMaps: true }

const enc = new cbor.Encoder(exports.encoderOpts)
const dec = new cbor.Decoder(exports.decoderOpts)

/**
 * Encodes a CBOR encodable object, with support for this application's Attachment and AttachmentReference objects
 * @param {any} data - arbitrary object to encode
 * @returns {Buffer} - cbor buffer
 */
exports.encode = function (data) {
  return enc.encode(data)
}

/**
 * Decodes first item in buffer using CBOR, unpacking any attachments included in the cbor too
 * @param {Buffer} buffer - buffer containing cbor which optionally uses tag 27 object representation to include Attachment and AttachmentReference objects
 * @returns {any} - returns decoded object
 */
exports.decode = function (inputBuffer) {
  return dec.decode(inputBuffer)
}

// provides encoder and decoder transform streams
const encImpl = require('./base-encoder-decoder-impl')
exports.encoder = encImpl.encoder.bind(exports)
exports.decoder = encImpl.decoder.bind(exports)

/**
 * Create a readable node buffer stream, from an iterable source
 * @param {Array|Iterable|IterableIterator|Generator|AsyncIterable|AsyncIterableIterator|AsyncGenerator}
 * @returns {Readable}
 */
exports.encodeIterable = (iterable) => Readable.from(cbor.encodeIter(iterable))

/**
 * Create an async iterable from a node stream of buffers or any other [async] iterable source of buffers
 * @param {AsyncIterable} readable
 * @yields {any}
 */
exports.decodeStream = (readable) => cbor.decodeIter(readable)
