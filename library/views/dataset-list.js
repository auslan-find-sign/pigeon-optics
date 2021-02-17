const layout = require('./layout')
const uri = require('encodeuricomponent-tag')

module.exports = (req, { list }) => {
  return layout(req, v => {
    v.panel(v => {
      v.breadcrumbs(v => {
        v.a('Home', { href: '/' })
        v.a('Datasets', { href: '/datasets/' })
      })

      for (const [user, tapes] of Object.entries(list)) {
        v.heading({ level: 3 }, v => {
          v.iconLink('user-circle', user, { href: uri`/users/${user}` })
          v.text(':')
        })
        v.ul(v => {
          for (const tape of tapes) {
            v.li(v => v.iconLink('cassette', tape, { href: uri`/datasets/${user}:${tape}/` }))
          }
        })
      }
    })
  })
}
