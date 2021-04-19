const cbor = require('cbor')

Object.assign(exports, {
  handles: ['application/cbor', 'application/x-cbor'],
  extensions: ['cbor'],
  decoderOpts: {},
  encoderOpts: { highWaterMark: 25000000 },

  /**
   * Decodes first item in buffer using CBOR, unpacking any attachments included in the cbor too
   * @param {Buffer} buffer - buffer containing cbor which optionally uses tag 27 object representation to include Attachment and AttachmentReference objects
   * @returns {any} - returns decoded object
   */
  decode (inputBuffer) {
    return cbor.decodeFirstSync(inputBuffer, this.decoderOpts)
  },

  decoder () {
    return new cbor.Decoder(this.decoderOpts)
  },

  encoder () {
    return new cbor.Encoder(this.encoderOpts)
  },

  /**
   * Encodes a CBOR encodable object, with support for this application's Attachment and AttachmentReference objects
   * @param {any} data - arbitrary object to encode
   * @returns {Buffer} - cbor buffer
   */
  encode (data) {
    return cbor.encodeOne(data, this.encoderOpts)
  }
})
