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
      v.header(v => {
        v.breadcrumbs(v => {
          v.a('Users', { href: '/users/' })
          v.iconLink('user-circle', profile.user, { href: uri`/users/${profile.user}/` })
        })
      })

      if (profile.memo) {
        v.p('Memo: ' + profile.memo)
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

      if (profile.user === req.user) {
        v.footer(v => {
          v.button('Create Dataset', { href: '/datasets/create' })
          v.button('Create Lens', { href: '/datasets/create' })
        })
      }
    })
  })
}
