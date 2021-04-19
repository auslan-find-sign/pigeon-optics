const msgpack = require('msgpack5')
module.exports = msgpack()
module.exports.handles = ['application/msgpack', 'application/x-msgpack']
module.exports.extensions = ['msgpack']
