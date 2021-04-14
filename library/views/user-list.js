const layout = require('./layout')
const uri = require('encodeuricomponent-tag')

module.exports = (req, { list }) => {
  return layout(req, async v => {
    await v.panel(async v => {
      v.header(v => {
        v.breadcrumbs(v => v.a('Users', { href: '/users/' }))
      })

      await v.ul(async v => {
        for await (const user of list) {
          v.li(v => v.iconLink('user-circle', user, { href: uri`/users/${user}/` }))
        }
      })
    })
  })
}
