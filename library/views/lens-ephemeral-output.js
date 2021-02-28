const layout = require('./layout')
const dateFormat = require('dateformat')
const codec = require('../models/codec')

module.exports = (req, { iter }) => {
  return layout(req, async v => {
    await v.panel(async v => {
      v.header(v => {
        v.breadcrumbs(v => {
          v.a('Home', { href: '/' })
          v.a('Lenses', { href: '/lenses/' })
          v.span('Ephemeral Test Run')
        })
      })

      for await (const obj of iter) {
        const [type, value] = Object.entries(obj)[0]
        if (type === 'log' && (value.logs.length || value.error)) {
          v.heading(`Logs for ${value.input}`)
          if (value.error) v.pre(`Error: ${value.error}`)
          if (value.logs.length) {
            v.ul(v => {
              for (const { type, timestamp, args } of value.logs) {
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
        } else if (type === 'record') {
          v.heading(`Output Record: ${value.id}`)
          v.sourceCode(codec.json.encode(value.data, 2))
        }
      }
    })
  })
}
