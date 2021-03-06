const layout = require('./layout')
const uri = require('encodeuricomponent-tag')

module.exports = (req, { list }) => {
  return layout(req, v => {
    v.panel(v => {
      v.header(v => {
        v.breadcrumbs(v => v.a('Users', { href: '/users/' }))
      })

      v.ul(v => {
        for (const user of list) {
          v.li(v => v.iconLink('user-circle', user, { href: uri`/users/${user}/` }))
        }
      })
    })
  })
}
