const layout = require('./layout')
const uri = require('encodeuricomponent-tag')

module.exports = (req, { list }) => {
  return layout(req, v => {
    v.panel(v => {
      v.panelTabs(v => {
        v.a('Lens', { href: uri`/lenses/${req.params.user}:${req.params.name}/` })
        if (req.owner) {
          v.a('Edit', { href: uri`/lenses/${req.params.user}:${req.params.name}/configuration` })
        }
        v.a('Logs', { href: uri`/lenses/${req.params.user}:${req.params.name}/logs` })
      })

      v.breadcrumbs(v => {
        v.a('Home', { href: '/' })
        v.a('Lenses', { href: '/lenses/' })
      })

      for (const [user, tapes] of Object.entries(list)) {
        v.heading({ level: 3 }, v => {
          v.iconLink('user-circle', user, { href: uri`/users/${user}/` })
          v.text(':')
        })
        v.ul(v => {
          for (const tape of tapes) {
            v.li(v => v.iconLink('3dglasses', tape, { href: uri`/lenses/${user}:${tape}/` }))
          }
        })
      }
    })
  })
}
