const layout = require('./layout')
const uri = require('encodeuricomponent-tag')
const exportFragment = require('./fragment-export')

/**
 * block to build a dataset manual record editor
 * @param {Request} req - express Request
 * @param {string} data - object with state info for the form
 * @param {null|string} error - null or a string with an error message
 */
module.exports = (req, state) => {
  return layout(req, v => {
    v.panel(v => {
      v.header(v => {
        v.breadcrumbs(v => {
          v.a('Lenses', { href: '/lenses/' })
          v.iconLink('user-circle', req.params.author, { href: uri`/authors/${req.params.author}/` })
          v.iconLink('3dglasses', req.params.name, { href: uri`/lenses/${req.params.author}:${req.params.name}/` })
        })

        v.panelTabs(
          { label: 'Lens', href: uri`/lenses/${req.params.author}:${req.params.name}/` },
          { label: 'Edit', href: uri`/lenses/${req.params.author}:${req.params.name}/configuration`, if: req.owner },
          { label: 'Logs', href: uri`/lenses/${req.params.author}:${req.params.name}/logs` },
          { label: 'Export', href: uri`/lenses/${req.params.author}:${req.params.name}/export`, current: true }
        )
      })

      exportFragment(v, req, state)
    })
  })
}
