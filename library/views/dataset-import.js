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
            v.iconLink('user-circle', req.params.author, { href: uri`/author/${req.params.author}` })
            v.iconLink('cassette', req.params.name, { href: uri`/datasets/${req.params.author}:${req.params.name}/` })
          })

          v.panelTabs(
            { label: 'View', href: uri`/datasets/${req.params.author}:${req.params.name}/` },
            { label: 'Edit', href: uri`/datasets/${req.params.author}:${req.params.name}/configuration`, if: req.owner },
            { label: 'Import', href: uri`/datasets/${req.params.author}:${req.params.name}/import`, current: true, if: req.owner },
            { label: 'Export', href: uri`/datasets/${req.params.author}:${req.params.name}/export` }
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

          v.dt('Overwrite')
          v.dd(v => {
            v.input({ name: 'overwrite', value: 'true', type: 'checkbox', id: 'overwrite-check', checked: state.overwrite })
            v.label(' Replace existing entries, removing anything not in this file', { for: 'overwrite-check' })
          })
          v.dt('Flat File')
          v.dd(v => {
            v.input({ name: 'mode', value: 'file', type: 'checkbox', id: 'mode-check', checked: state.overwrite })
            v.label(' Data is contained in a single file', { for: 'mode-check' })
          })
        })

        v.footer(v => {
          v.button('Upload', { type: 'submit' })
        })
      })
    })
  })
}
