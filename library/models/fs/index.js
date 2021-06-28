/**
 * FS serves as an abstraction to the filesystem, which can work in a chunked streaming way,
 * without ever using node streams. Mainly, dealing with async iterators natively. Why?
 * Because streams are a fricking nightmare. Errors fly every which way, and get lost because
 * pipelines are complicated and messy. No thank you. Streams are a legacy structure that
 * serves almost no useful purpose now we have async iterators and async generators, with
 * propper error handling that can build a useful stacktrace when things go wrong.
 */

exports.raw = require('./raw')
exports.objects = require('./objects')
