const uri = require('encodeuricomponent-tag')
const pkg = require('../../package.json')

module.exports = (req, block) => {
  return async v => {
    v.header(v => {
      // pigeon optics icon
      v.a({ href: '/', class: 'home-icon' }, v => v.img({ src: '/design/icon.svg', alt: pkg.defaults.title, style: { height: '1.5em' } }))
      v.span({ style: { flexGrow: 1 } })
      v.iconButton('cassette', 'Datasets', { href: '/datasets/' })
      v.iconButton('3dglasses', 'Lenses', { href: '/lenses/' })
      v.iconButton('users', 'Authors', { href: '/authors/' })

      v.span({ style: { flexGrow: 10 } })
      v.iconButton('magnifier', 'Search', { href: '/search' })
      if (req.author) {
        v.iconButton('user-circle', req.author, { href: uri`/authors/${req.author}/` })
        v.iconButton('sign-out', 'Logout', { href: uri`/auth/logout` })
      } else {
        v.iconButton('user-circle', 'Login', { href: uri`/auth` })
      }
    })

    await v.main(async v => {
      await block.call(v, v)
    })

    v.footer(v => {
      v.text(`Pigeon Optics v ${pkg.version}`)
      v.a({ href: pkg.homepage }, 'View Source')
      v.a({ href: 'https://find.auslan.fyi/' }, 'Find Sign')
    })
  }
}
