const msgpack = require('msgpack5')()
msgpack.handles = ['application/msgpack', 'application/x-msgpack']
msgpack.extensions = ['msgpack']

// hash a name in to an id number between 0 and 128, to use as an extension point type number
function nameToExtID (name) {
  return 1 + Array.prototype.reduce.call(name, (a, b) => a + parseInt(b, 36), 0) % 127
}

const setTypeNumber = nameToExtID('set') // 72
// Set's are encoded to an extension, which contains a messagepack encoded array of the set's elements
msgpack.register(setTypeNumber, Set, set => msgpack.encode([...set]), buffer => new Set(msgpack.decode(buffer)))

module.exports = msgpack
