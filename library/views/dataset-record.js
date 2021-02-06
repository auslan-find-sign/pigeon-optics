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
    v.heading(`Record ID: ${req.params.recordID}`)
    if (req.owner) {
      v.flexRow(v => {
        v.flexSpacer(5)
        v.button('Edit', { href: uri`/datasets/${req.params.user}:${req.params.name}/${req.params.recordID}/edit` })
      })
    }
    v.sourceCode(codec.json.encode(record, 2))
  })
}
