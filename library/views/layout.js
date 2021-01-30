const uri = require('encodeuricomponent-tag')
const pkg = require('../../package.json')

module.exports = (req, block) => {
  return (v) => {
    v.toolbar(() => {
      // datasets icon
      v.a({ href: '/', class: 'home-icon' }, () => {
        v.img({ src: '/design/datasets-icon.png', alt: 'Site Icon', style: { height: '1.5em' } })
        v.text(' Datasets')
      })
      v.flexSpacer(5)
      // search box
      v.form({ id: 'search', action: '/search', method: 'GET' }, () => {
        v.input({ type: 'search', name: 'q', value: req.query.q })
      })
      v.flexSpacer(5)
      // auth state links
      v.span({ id: 'auth-links' }, () => {
        if (req.session && req.session.auth) {
          v.a({ href: uri`/users/${req.session.auth.user}` }, `${req.session.auth.user}`)
          v.text(' ')
          v.a({ href: uri`/auth/logout` }, 'Logout')
        } else {
          v.a({ href: uri`/auth/login` }, 'Login')
        }
      })
    })

    block(v)

    v.flexRow({ class: 'footer' }, () => {
      v.text(`Auslan Find Sign - Datasets v${pkg.version}`)
      v.flexSpacer(5)
      v.a({ href: pkg.homepage }, 'Open Source')
      v.flexSpacer(5)
      v.a({ href: 'https://find.auslan.fyi/' }, 'Find Sign')
    })
  }
}
