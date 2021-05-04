const layout = require('./layout')
const uri = require('encodeuricomponent-tag')

module.exports = (req, { list }) => {
  return layout(req, v => {
    v.panel(v => {
      v.header(v => {
        v.breadcrumbs(v => {
          v.a('Datasets', { href: '/datasets/' })
        })
      })

      for (const [author, tapes] of Object.entries(list)) {
        v.heading({ level: 3 }, v => {
          v.iconLink('user-circle', author, { href: uri`/authors/${author}` })
          v.text(':')
        })
        v.ul(v => {
          for (const tape of tapes) {
            v.li(v => v.iconLink('cassette', tape, { href: uri`/datasets/${author}:${tape}/` }))
          }
        })
      }

      if (req.session.auth) {
        v.footer(v => v.button('Create', { href: '/datasets/create' }))
      }
    })
  })
}
