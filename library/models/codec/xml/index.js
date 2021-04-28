const pxml = require('pigeonmark-xml')

exports.handles = pxml.handles
exports.extensions = pxml.extensions

exports.encode = require('./encode')
exports.decode = require('./decode')

exports.encoder = require('./encoder')
exports.entriesEncoder = require('./entries-encoder')
