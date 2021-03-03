const layout = require('./layout')
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
          if (value.error) v.stacktrace(value.error)
          if (value.logs.length) v.logs(value.logs)
        } else if (type === 'record') {
          v.heading(`Output Record: ${value.id}`)
          v.sourceCode(codec.json.encode(value.data, 2))
        }
      }
    })
  })
}
