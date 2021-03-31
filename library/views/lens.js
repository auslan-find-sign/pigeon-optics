const layout = require('./layout')
const uri = require('encodeuricomponent-tag')
const naturalCompare = require('string-natural-compare')

/**
 * block to build a login/register form page
 * @param {Request} req - express Request
 * @param {string} mode - either 'login' or 'register'
 * @param {null|string} error - null or a string with an error message
 */
module.exports = (req, config) => {
  return layout(req, v => {
    v.panel(v => {
      v.header(v => {
        v.breadcrumbs(v => {
          v.a('Home', { href: '/' })
          v.a('Lenses', { href: '/lenses/' })
          v.iconLink('user-circle', req.params.user, { href: uri`/users/${req.params.user}/` })
          v.iconLink('3dglasses', req.params.name, { href: uri`/lenses/${req.params.user}:${req.params.name}/` })
        })

        v.panelTabs(
          { label: 'Lens', href: uri`/lenses/${req.params.user}:${req.params.name}/`, current: true },
          req.owner && { label: 'Edit', href: uri`/lenses/${req.params.user}:${req.params.name}/configuration` },
          { label: 'Logs', href: uri`/lenses/${req.params.user}:${req.params.name}/logs` }
        )
      })

      if (config.memo) {
        v.p('Memo: ' + config.memo)
      }

      v.p(v => {
        v.text('Data from ')
        v.inlineList(config.inputs, x => v.a(x, { href: x }))
      })

      if (config.mapType === 'javascript') {
        v.heading('Map Function:', { level: 3 })
        v.sourceCode(config.mapCode)
      } else if (config.mapType === 'webhook') {
        v.heading('Map Webhook:', { level: 3 })
        v.p(v => v.a(config.mapCode, { href: config.mapCode }))
      }

      v.heading('Reduce Function:', { level: 3 })
      v.sourceCode(config.reduceCode)

      v.heading('Records:', { level: 3 })
      v.linkList(Object.keys(config.records).sort(naturalCompare), name => uri`/lenses/${req.params.user}:${req.params.name}/records/${name}`)

      if (req.session.auth) {
        v.footer(v => {
          v.button('Clone', { href: uri`/lenses/create?clone=${req.params.user}:${req.params.name}` })
        })
      }
    })
  })
}
