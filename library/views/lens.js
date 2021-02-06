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
    v.heading(`Lens ${req.params.user}:${req.params.name}`)
    if (config.memo) {
      v.p(config.memo)
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

    if (req.owner) {
      v.flexRow(v => { v.flexSpacer(5); v.button('Edit', { href: uri`/lenses/${req.params.user}:${req.params.name}/edit` }) })
    }

    v.heading('Records:', { level: 3 })
    v.linkList(records, name => uri`/lenses/${req.params.user}:${req.params.name}/${name}`)
  })
}
