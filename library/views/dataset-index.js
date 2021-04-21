const layout = require('./layout')
const uri = require('encodeuricomponent-tag')
const naturalCompare = require('string-natural-compare')

/**
 * block to build a dataset manual record editor
 * @param {Request} req - express Request
 * @param {string} data - object with state info for the form
 * @param {null|string} error - null or a string with an error message
 */
module.exports = (req, { config }) => {
  return layout(req, v => {
    v.panel(v => {
      v.header(v => {
        v.breadcrumbs(v => {
          v.a('Datasets', { href: '/datasets/' })
          v.iconLink('user-circle', req.params.user, { href: uri`/users/${req.params.user}` })
          v.iconLink('cassette', req.params.name, { href: uri`/datasets/${req.params.user}:${req.params.name}/` })
        })

        if (req.owner) {
          v.panelTabs(
            { label: 'View', href: uri`/datasets/${req.params.user}:${req.params.name}/`, current: true },
            { label: 'Edit', href: uri`/datasets/${req.params.user}:${req.params.name}/configuration` },
            { label: 'Import', href: uri`/datasets/${req.params.user}:${req.params.name}/import/files` }
          )
        }
      })

      v.heading(`Dataset: ${req.params.name}`)
      if (config.memo) v.p(config.memo)
      v.heading('Records:', { level: 3 })
      const recordIDs = Object.keys(config.records).sort(naturalCompare)
      v.linkList(recordIDs, id => uri`/datasets/${req.params.user}:${req.params.name}/records/${id}`)

      if (req.owner) {
        v.footer(v => {
          v.button('Add Record', { href: uri`/datasets/${req.params.user}:${req.params.name}/create-record` })
        })
      }
    })
  })
}
