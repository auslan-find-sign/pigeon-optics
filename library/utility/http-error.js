module.exports = function (httpCode, message) {
  let err = new Error(message)
  err.httpCode = httpCode
  return err
}