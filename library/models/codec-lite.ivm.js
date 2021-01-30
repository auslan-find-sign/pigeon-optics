/**
 * A limited JSON-only version of Codec library, which is used inside the
 * Isolated VM for communicating dataset entries back and forward between VMs
 * This code runs to initialise the Isolated VM, in it's global scope. This
 * could also be used in a web scope for client side encoding/decoding
 */

class AttachmentReference {
  constructor (hash, mimeType) {
    if (!(hash instanceof ArrayBuffer)) throw new Error('data must be an Array Buffer')
    if (typeof mimeType !== 'string') throw new Error('mimeType must be a string')
    this.hash = hash
    this.mimeType = mimeType
  }
}

class Attachment extends AttachmentReference {
  constructor (data, mimeType) {
    if (!(data instanceof ArrayBuffer)) throw new Error('data must be an Array Buffer')
    super(Uint8Array.from([]), mimeType)
    this.data = data
  }
}

const codec = {
  cloneable: {
    decode (object) {
      if (Array.isArray(object)) {
        return object.map(entry => this.decode(entry))
      } else if (typeof object === 'object') {
        if ('_bufferArrayBytes' in object) {
          return Uint8Array.from(object._bufferArrayBytes)
        } else if (object._class === 'Attachment') {
          const attachment = new Attachment(Uint8Array.from(object._bytes), object._mimeType)
          attachment.hash = Uint8Array.from(object._hash)
          return Object.freeze(attachment)
        } else if (object._class === 'AttachmentReference') {
          return Object.freeze(new AttachmentReference(Uint8Array.from(object._hashBytes), object._mimeType))
        }

        return Object.fromEntries(Object.entries(object).map(([key, value]) => {
          return [key, this.decode(value)]
        }))
      } else {
        return object
      }
    },

    encode (object) {
      if (Array.isArray(object)) {
        return object.map(entry => this.encode(entry))
      } else if (object instanceof ArrayBuffer) {
        return { _bufferArrayBytes: [...object] }
      } else if (object instanceof Attachment) {
        return {
          _class: 'Attachment',
          _bytes: [...object.data],
          _mimeType: object.mimeType,
          _hash: [...object.hash]
        }
      } else if (object instanceof AttachmentReference) {
        return {
          _class: 'AttachmentReference',
          _mimeType: object.mimeType,
          _hash: [...object.hash]
        }
      } else if (typeof object === 'object') {
        return Object.fromEntries(Object.entries(object).map(([key, value]) => {
          return [key, this.decode(value)]
        }))
      }

      return object
    }
  }
}
