const layout = require('./layout')
const uri = require('encodeuricomponent-tag')
const codec = require('../models/codec')
const highlight = require('h.js')

module.exports = (req, { mapOutputs }) => {
  return layout(req, v => {
    v.panel(v => {
      v.header(v => {
        v.breadcrumbs(v => {
          v.a('Home', { href: '/' })
          v.a('Lenses', { href: '/lenses/' })
          v.iconLink('user-circle', req.params.user, { href: uri`/users/${req.params.user}/` })
          v.iconLink('3dglasses', req.params.name, { href: uri`/lenses/${req.params.user}:${req.params.name}/` })
          v.a('Lens Build Logs', { href: uri`/lenses/${req.params.user}:${req.params.name}/logs` })
        })

        v.panelTabs(
          { label: 'Lens', href: uri`/lenses/${req.params.user}:${req.params.name}/` },
          req.owner && { label: 'Edit', href: uri`/lenses/${req.params.user}:${req.params.name}/configuration` },
          { label: 'Logs', href: uri`/lenses/${req.params.user}:${req.params.name}/logs`, current: true }
        )
      })

      for (const { input, error, logs } of mapOutputs) {
        v.heading({ level: 3 }, v => v.a(input, { href: input }))

        if (error) v.stacktrace(error)

        if (logs && logs.length > 0) {
          v.heading('console.log/warn/info/error:')
          v.logs(logs)
        }
      }
    })
  })
}
