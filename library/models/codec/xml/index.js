exports.handles = ['application/xml', 'text/xml', 'application/rdf+xml', 'application/rss+xml', 'application/atom+xml', 'text/xml', 'application/xhtml+xml']
exports.extensions = ['xml', 'rss', 'atom', 'xhtml']

exports.encode = require('./encode')
exports.decode = require('./decode')

exports.encoder = require('./encoder')
exports.entriesEncoder = require('./entries-encoder')
