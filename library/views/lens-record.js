const layout = require('./layout')
const codec = require('../models/codec')
const uri = require('encodeuricomponent-tag')

module.exports = (req, { record, sidebar }) => {
  return layout(req, v => {
    v.sidebar(v => {
      v.heading('Records')

      v.ul(v => {
        for (const recordID of sidebar.recordIDs) {
          const attribs = recordID === req.params.recordID ? { class: 'selected' } : {}
          v.li(attribs, v => v.a(recordID, { href: uri`/lenses/${req.params.user}:${req.params.name}/records/${recordID}` }))
        }
      })
    })

    v.panel(v => {
      v.header(v => {
        v.breadcrumbs(v => {
          v.a('Lenses', { href: '/lenses/' })
          v.iconLink('user-circle', req.params.user, { href: uri`/users/${req.params.user}` })
          v.iconLink('3dglasses', req.params.name, { href: uri`/lenses/${req.params.user}:${req.params.name}/` })
          v.iconLink('newspaper', req.params.recordID, { href: uri`/lenses/${req.params.user}:${req.params.name}/${req.params.recordID}` })
        })
      })

      v.sourceCode(codec.json.encode(record, 2), { class: 'expand' })
    })
  })
}
