const layout = require('./layout')
const uri = require('encodeuricomponent-tag')
const dateFormat = require('dateformat')
const codec = require('../models/codec')

module.exports = (req, { mapOutputs }) => {
  return layout(req, v => {
    v.panelTabs(
      { label: 'Lens', href: uri`/lenses/${req.params.user}:${req.params.name}/` },
      req.owner && { label: 'Edit', href: uri`/lenses/${req.params.user}:${req.params.name}/configuration` },
      { label: 'Logs', href: uri`/lenses/${req.params.user}:${req.params.name}/logs`, current: true }
    )

    v.panel(v => {
      v.breadcrumbs(v => {
        v.a('Home', { href: '/' })
        v.a('Lenses', { href: '/lenses/' })
        v.iconLink('user-circle', req.params.user, { href: uri`/users/${req.params.user}/` })
        v.iconLink('3dglasses', req.params.name, { href: uri`/lenses/${req.params.user}:${req.params.name}/` })
        v.a('Lens Build Logs', { href: uri`/lenses/${req.params.user}:${req.params.name}/logs` })
      })

      for (const { input, error, logs } of mapOutputs) {
        v.heading({ level: 3 }, v => v.a(input, { href: input }))

        if (error) {
          v.heading({ level: 4 }, v => { v.icon('notice-in-circle'); v.text('Error:') })
          v.pre(error)
        }

        if (logs && logs.length > 0) {
          v.ul(v => {
            for (const { type, timestamp, args } of logs) {
              const friendlyTimestamp = dateFormat(timestamp, 'ddd mmm dd yyyy HH:MM:ss.l')
              const machineTimestamp = dateFormat(timestamp, "UTC:yyyy-mm-dd'T'HH:MM:ss.l'Z'")
              v.li({ class: [`log-entry log-entry-type-${type}`] }, v => {
                v.time(friendlyTimestamp, { datetime: machineTimestamp })
                v.text(': [')
                v.code(`console.${type}`, { class: 'log-type' })
                v.text(']')
                for (const arg of args) {
                  v.text(' ')
                  v.code(typeof arg === 'string' ? arg : codec.json.encode(arg))
                }
              })
            }
          })
        }
      }
    })
  })
}
