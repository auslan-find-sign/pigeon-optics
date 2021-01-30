const layout = require('./layout')
/**
 * build's homepage
 * @param {Request} req - express Request
 */
module.exports = (req) => {
  return layout(req, v => {
    v.div({ class: 'notice-panel' }, v => {
      v.heading('Datasets Project')

      v.p('This is a work in progress database for storing and processing search index information for Find Sign and making it accessible for other developers to build apps')
    })
  })
}
