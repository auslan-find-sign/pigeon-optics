const layout = require('./layout')
const uri = require('encodeuricomponent-tag')

/**
 * block to build a dataset manual record editor
 * @param {Request} req - express Request
 * @param {string} data - object with state info for the form
 * @param {null|string} error - null or a string with an error message
 */
module.exports = (req, { config, recordIDs }) => {
  return layout(req, v => {
    v.breadcrumbs(v => {
      v.a('Home', { href: '/' })
      v.a('Datasets', { href: '/datasets/' })
      v.iconLink('cassette', `${req.params.user}:${req.params.name}`, { href: uri`/datasets/${req.params.user}:${req.params.name}/` })
    })

    v.heading(`Dataset: ${req.params.name}`)
    if (config.memo) v.p(config.memo)
    v.heading('Records:', { level: 3 })
    v.linkList(recordIDs, id => uri`/datasets/${req.params.user}:${req.params.name}/${id}`)

    if (req.owner) {
      v.button('Add Record', { href: uri`/datasets/create-record/${req.params.user}:${req.params.name}` })
    }
  })
}
