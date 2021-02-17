const layout = require('./layout')
const uri = require('encodeuricomponent-tag')

/**
 * block to build a login/register form page
 * @param {Request} req - express Request
 * @param {string} mode - either 'login' or 'register'
 * @param {null|string} error - null or a string with an error message
 */
module.exports = (req, profile, datasets, lenses) => {
  return layout(req, v => {
    v.panel(v => {
      v.breadcrumbs(v => {
        v.a('Home', { href: '/' })
        v.a('Users', { href: '/users/' })
        v.iconLink('user-circle', 'Users', { href: uri`/users/${profile.user}/` })
      })

      v.heading(`${profile.auth}: ${profile.user}`)
      if (profile.memo) {
        v.p(profile.memo)
      }

      v.heading('Datasets:', { level: 3 })
      v.ul(v => {
        for (const dataset of datasets) {
          v.li(v => v.iconLink('cassette', dataset, { href: uri`/datasets/${profile.user}:${dataset}/` }))
        }
      })

      v.heading('Lenses:', { level: 3 })
      v.ul(v => {
        for (const lens of lenses) {
          v.li(v => v.iconLink('3dglasses', lens, { href: uri`/lenses/${profile.user}:${lens}/` }))
        }
      })
    })
  })
}
