const layout = require('./layout')

/**
 * block to build a javascript lens editor form
 * @param {Request} req - express Request
 * @param {string} data - object with name, mapCode, and mergeCode properties, optionally create can be true
 * @param {null|string} error - null or a string with an error message
 */
module.exports = (req, data, error = null) => {
  return layout(req, v => {
    v.flexRow(v => {
      v.heading(`${req.params.user}’s “${req.params.name}” Lens Code:`)
      v.flexSpacer(5)
      v.button('Edit', { href: 'edit' })
    })

    v.heading('Map Code:', { level: 3 })
    v.sourceCode(data.mapCode)

    v.heading('Merge Code:', { level: 3 })
    v.sourceCode(data.mergeCode)
  })
}
