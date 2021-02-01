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
    v.heading(`Viewport ${req.params.user}:${req.params.name}`)
    if (config.memo) {
      v.p(config.memo)
    }

    v.p(v => {
      v.text('Data feeding in from ')
      v.inlineList(config.inputs, x => {
        v.a(x, { href: x })
      })
      v.text(' via lens ')
      v.a(`${config.lens.user}:${config.lens.name}`, { href: uri`/lenses/${config.lens.user}:${config.lens.name}/` })
      v.text('.')
    })

    v.heading('Records:', { level: 3 })
    v.linkList(records, name => uri`/viewports/${req.params.user}:${req.params.name}/${name}`)
  })
}
