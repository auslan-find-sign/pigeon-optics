const layout = require('./layout')
const uri = require('encodeuricomponent-tag')

/**
 * block to build a login/register form page
 * @param {Request} req - express Request
 * @param {string} mode - either 'login' or 'register'
 * @param {null|string} error - null or a string with an error message
 */
module.exports = (req, config, records) => {
  return layout(req, v => {
    v.panel(v => {
      v.panelTabs(v => {
        v.a('Lens', { href: uri`/lenses/${req.params.user}:${req.params.name}/` })
        if (req.owner) {
          v.a('Edit', { href: uri`/lenses/${req.params.user}:${req.params.name}/configuration` })
        }
        v.a('Logs', { href: uri`/lenses/${req.params.user}:${req.params.name}/logs` })
      })

      v.breadcrumbs(v => {
        v.a('Home', { href: '/' })
        v.a('Lenses', { href: '/lenses/' })
        v.iconLink('user-circle', req.params.user, { href: uri`/users/${req.params.user}/` })
        v.iconLink('3dglasses', req.params.name, { href: uri`/lenses/${req.params.user}:${req.params.name}/` })
      })

      v.heading(`Lens ${req.params.user}:${req.params.name}`)
      if (config.memo) {
        v.p(config.memo)
      }

      if (req.session.auth) {
        v.flexRow(v => {
          v.flexSpacer(5)
          if (req.owner) v.button('Edit', { href: uri`/lenses/${req.params.user}:${req.params.name}/configuration` })
          v.button('Clone', { href: uri`/lenses/create?clone=${req.params.user}:${req.params.name}` })
        })
      }

      v.p(v => {
        v.text('Data feeding in from ')
        v.inlineList(config.inputs, x => {
          v.a(x, { href: x })
        })
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
      v.linkList(records, name => uri`/lenses/${req.params.user}:${req.params.name}/records/${name}`)
    })
  })
}
