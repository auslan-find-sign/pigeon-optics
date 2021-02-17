const layout = require('./layout')
const codec = require('../models/codec')
const uri = require('encodeuricomponent-tag')

/**
 * block to build a dataset manual record editor
 * @param {Request} req - express Request
 * @param {string} data - object with state info for the form
 * @param {null|string} error - null or a string with an error message
 */
module.exports = (req, record) => {
  return layout(req, v => {
    v.panel(v => {
      v.breadcrumbs(v => {
        v.a('Home', { href: '/' })
        v.a('Lenses', { href: '/lenses/' })
        v.iconLink('user-circle', req.params.user, { href: uri`/users/${req.params.user}` })
        v.iconLink('3dglasses', req.params.name, { href: uri`/lenses/${req.params.user}:${req.params.name}/` })
        v.iconLink('newspaper', req.params.recordID, { href: uri`/lenses/${req.params.user}:${req.params.name}/${req.params.recordID}` })
      })

      v.heading(`Record ID: ${req.params.recordID}`)
      v.sourceCode(codec.json.encode(record, 2))
    })
  })
}
