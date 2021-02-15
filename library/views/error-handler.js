const layout = require('./layout')

/**
 * @param {Request} req - express Request
 * @param {string} error - Error object
 */
module.exports = (req, error) => {
  return layout(req, v => {
    v.heading(`Error processing request (${error.name} ${error.code}):`)
    v.p(error.message)
    if (error.stack && (process.env.NODE_ENV !== 'production' || (req.session && req.session.auth && req.session.auth.auth === 'admin'))) v.pre(error.stack)
  })
}
