/**
 * HTML codec, transforms JsonML format in to compact HTML, and vice versa
 */
exports.handles = ['text/html']
exports.extensions = ['html', 'htm']

exports.decode = require('./decode')
exports.encode = require('./encode')
