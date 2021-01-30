const layout = require('./layout')
const uri = require('encodeuricomponent-tag')

/**
 * block to build a login/register form page
 * @param {Request} req - express Request
 * @param {string} mode - either 'login' or 'register'
 * @param {null|string} error - null or a string with an error message
 */
module.exports = (req, profile, datasets, viewports, lenses) => {
  return layout(req, v => {
    v.heading(`${profile.auth}: ${profile.user}`)

    v.heading('Datasets:', { level: 3 })
    for (const dataset of datasets) {
      v.div(v => v.a(dataset, { href: uri`/datasets/${profile.user}:${dataset}/` }))
    }

    v.heading('Viewports:', { level: 3 })
    for (const viewport of viewports) {
      v.div(v => v.a(viewport, { href: uri`/viewports/${profile.user}:${viewport}/` }))
    }

    v.heading('Javascript Lenses:', { level: 3 })
    for (const lens of lenses) {
      v.div(v => v.a(lens, { href: uri`/lenses/${profile.user}:${lens}/` }))
    }
  })
}
