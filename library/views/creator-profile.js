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
    v.panel({ class: 'identity' }, v => {
      v.header(v => {
        v.breadcrumbs(v => {
          v.a('Authors', { href: '/authors/' })
          v.iconLink('user-circle', profile.author, { href: uri`/authors/${req.params.author}/` })
        })
      })

      if (profile.memo) {
        v.p('Memo: ' + profile.memo)
      }

      v.heading('Datasets:', { level: 3 })
      v.ul(v => {
        for (const dataset of datasets) {
          v.li(v => v.iconLink('cassette', dataset, { href: uri`/datasets/${req.params.author}:${dataset}/` }))
        }
      })

      v.heading('Lenses:', { level: 3 })
      v.ul(v => {
        for (const lens of lenses) {
          v.li(v => v.iconLink('3dglasses', lens, { href: uri`/lenses/${req.params.author}:${lens}/` }))
        }
      })

      if (req.params.author === req.author) {
        v.footer(v => {
          v.button('Create Dataset', { href: '/datasets/create' })
          v.button('Create Lens', { href: '/datasets/create' })
        })
      }
    })
  })
}
