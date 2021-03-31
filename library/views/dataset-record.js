const layout = require('./layout')
const codec = require('../models/codec')
const uri = require('encodeuricomponent-tag')
const naturalCompare = require('string-natural-compare')

/**
 * block to build a dataset manual record editor
 * @param {Request} req - express Request
 * @param {string} data - object with state info for the form
 * @param {null|string} error - null or a string with an error message
 */
module.exports = (req, { record, sidebar }) => {
  return layout(req, v => {
    v.sidebar(v => {
      v.heading('Records')

      v.ul(v => {
        for (const recordID of sidebar.recordIDs.sort(naturalCompare)) {
          const attribs = recordID === req.params.recordID ? { class: 'selected' } : {}
          v.li(attribs, v => v.a(recordID, { href: uri`/datasets/${req.params.user}:${req.params.name}/records/${recordID}` }))
        }
      })
    })

    v.panel(v => {
      v.header(v => {
        v.breadcrumbs(v => {
          v.a('Datasets', { href: '/datasets/' })
          v.iconLink('user-circle', req.params.user, { href: uri`/users/${req.params.user}` })
          v.iconLink('cassette', req.params.name, { href: uri`/datasets/${req.params.user}:${req.params.name}/` })
          v.iconLink('newspaper', req.params.recordID, { href: uri`/datasets/${req.params.user}:${req.params.name}/records/${req.params.recordID}` })
        })

        if (req.owner) {
          v.panelTabs(
            { label: 'View', href: uri`/datasets/${req.params.user}:${req.params.name}/records/${req.params.recordID}`, current: true },
            { label: 'Edit', href: uri`/datasets/${req.params.user}:${req.params.name}/records/${req.params.recordID}?edit=1` }
          )
        }
      })

      v.sourceCode(codec.json.print(record), { class: 'expand' })
    })
  })
}
