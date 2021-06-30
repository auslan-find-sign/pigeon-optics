function restack (error) {
  if (error && typeof error === 'object') {
    Error.captureStackTrace(error, restack)
  }
  return error
}

module.exports = restack
