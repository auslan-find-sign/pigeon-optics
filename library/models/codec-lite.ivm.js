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

const codec = {}
codec.cloneable = {}
codec.cloneable.decode = function (object) {
  if (Array.isArray(object)) {
    return object.map(entry => codec.cloneable.decode(entry))
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
      return [key, codec.cloneable.decode(value)]
    }))
  } else {
    return object
  }
}

codec.cloneable.encode = function (object) {
  if (Array.isArray(object)) {
    return object.map(entry => codec.cloneable.encode(entry))
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
      return [key, codec.cloneable.encode(value)]
    }))
  }

  return object
}

codec.path = {
  // generated with path-to-regexp
  regexp: /^(?:\/(lenses|datasets))(?:\/([^/#?]+?)):([^/#?]+?)(?:\/([^/#?]+?))?[/#?]?$/,

  /** decodes a data path in to:
   * @param {string} dataPath - like /source/user:name/recordID or /source/user:name/
   * @returns {DataPathComponents}
   * @typedef {Object} DataPathComponents
   * @property {'datasets'|'lenses'} source
   * @property {string} user
   * @property {string} name
   * @property {string} [recordID]
   */
  decode (string) {
    const match = string.match(this.regexp)
    if (match) {
      const [source, user, name, recordID] = match.slice(1)
      return { source, user, name, recordID }
    } else {
      return false
    }
  }
}
