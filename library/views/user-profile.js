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
    v.linkList(datasets, name => uri`/datasets/${profile.user}:${name}/`)

    v.heading('Viewports:', { level: 3 })
    v.linkList(viewports, name => uri`/viewports/${profile.user}:${name}/`)

    v.heading('Javascript Lenses:', { level: 3 })
    v.linkList(lenses, name => uri`/lenses/${profile.user}:${name}/`)
  })
}
