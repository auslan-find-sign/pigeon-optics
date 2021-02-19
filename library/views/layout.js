const uri = require('encodeuricomponent-tag')
const pkg = require('../../package.json')

module.exports = (req, block) => {
  return async v => {
    v.nav(v => {
      // pigeon optics icon
      v.a({ href: '/', class: 'home-icon' }, v => v.img({ src: '/design/icon.svg', alt: pkg.defaults.title, style: { height: '1.5em' } }))
      v.flexSpacer(1)
      v.iconButton('cassette', 'Datasets', { href: '/datasets/' })
      v.iconButton('3dglasses', 'Lenses', { href: '/lenses/' })
      v.iconButton('users', 'Users', { href: '/users/' })

      v.flexSpacer(10)
      v.iconButton('magnifier', 'Search', { href: '/search' })
      if (req.session && req.session.auth) {
        v.iconButton('user-circle', req.session.auth.user, { href: uri`/users/${req.session.auth.user}/` })
        v.iconButton('sign-out', 'Logout', { href: uri`/auth/logout` })
      } else {
        v.iconButton('user-circle', 'Login', { href: uri`/auth` })
      }
    })

    await block(v)

    v.footer(v => {
      v.flexRow(v => {
        v.text(`Pigeon Optics v ${pkg.version}`)
        v.flexSpacer(5)
        v.a({ href: pkg.homepage }, 'View Source')
        v.flexSpacer(5)
        v.a({ href: 'https://find.auslan.fyi/' }, 'Find Sign')
      })
    })
  }
}
