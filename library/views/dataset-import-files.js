const layout = require('./layout')
const uri = require('encodeuricomponent-tag')

/**
 * block to build a dataset manual record editor
 * @param {Request} req - express Request
 * @param {string} data - object with state info for the form
 * @param {null|string} error - null or a string with an error message
 */
module.exports = (req, state) => {
  return layout(req, v => {
    v.form({ method: 'PUT', enctype: 'multipart/form-data' }, v => {
      v.panel(v => {
        v.header(v => {
          v.breadcrumbs(v => {
            v.a('Datasets', { href: '/datasets/' })
            v.iconLink('user-circle', req.params.user, { href: uri`/users/${req.params.user}` })
            v.iconLink('cassette', req.params.name, { href: uri`/datasets/${req.params.user}:${req.params.name}/` })
          })

          v.panelTabs(
            { label: 'View', href: uri`/datasets/${req.params.user}:${req.params.name}/` },
            { label: 'Edit', href: uri`/datasets/${req.params.user}:${req.params.name}/configuration` },
            { label: 'Import', href: uri`/datasets/${req.params.user}:${req.params.name}/import/files`, current: true }
          )
        })

        if (state.error) {
          v.p(v => { v.glitch('Error: '); v.text(state.error) })
        }

        if (state.wroteCount) {
          v.p(v => { v.bold('Status: '); v.text(`${state.wroteCount} files were uploaded as records`) })
        }

        v.dl(v => {
          v.dt('Select Files')
          v.dd(v => v.input({ name: 'file', type: 'file', required: true, multiple: true }))
        })

        v.footer(v => {
          v.button('Upload', { type: 'submit' })
        })
      })
    })
  })
}
