const layout = require('./layout')
const uri = require('encodeuricomponent-tag')

/**
 * block to build a dataset config editor form
 * @param {Request} req - express Request
 * @param {string} data - object with state info for the form
 * @param {null|string} error - null or a string with an error message
 */
module.exports = (req, data, error = null) => {
  return layout(req, v => {
    v.form({ class: 'simple-form', method: 'PUT', action: data.create ? '' : uri`/datasets/${req.params.user}:${req.params.name}` }, v => {
      if (req.owner && !data.create) {
        v.panelTabs(
          { label: 'View', href: uri`/datasets/${req.params.user}:${req.params.name}/` },
          { label: 'Edit', href: uri`/datasets/${req.params.user}:${req.params.name}/configuration`, current: true }
        )
      }

      v.panel(v => {
        v.breadcrumbs(v => {
          v.a('Home', { href: '/' })
          v.a('Datasets', { href: '/datasets/' })
          v.iconLink('user-circle', req.params.user, { href: uri`/users/${req.params.user}` })
          v.iconLink('cassette', req.params.name, { href: uri`/datasets/${req.params.user}:${req.params.name}/` })
        })

        if (data.create) {
          v.heading('Create Dataset')
        } else {
          v.heading(`Editing “${req.params.name}”`)
        }

        if (error) {
          v.p(v => { v.glitch('Error: '); v.text(error) })
        }

        v.dl(v => {
          v.dt('Dataset Name')
          v.dd(v => v.input({ name: 'name', value: data.name, minlength: 1, maxlength: 60, pattern: "[^!*'();:@&=+$,/?%#[\\]]+", disabled: !data.create }))

          v.dt('Memo (short description)')
          v.dd(v => v.textarea(data.memo, { name: 'memo', spellcheck: 'true', wrap: 'off' }))
        })
      })

      v.panelActions(
        data.create && { label: 'Create', attributes: { type: 'submit' } },
        !data.create && { label: 'Save', attributes: { type: 'submit', formmethod: 'PUT' } },
        !data.create && { label: 'Delete', attributes: { type: 'submit', formmethod: 'DELETE' } }
      )
    })
  })
}
