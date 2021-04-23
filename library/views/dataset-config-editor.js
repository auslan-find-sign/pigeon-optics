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
    v.form({ class: 'simple-form', method: 'PUT', action: data.create ? '' : uri`/datasets/${req.params.user}:${req.params.name}/configuration` }, v => {
      v.panel(v => {
        v.header(v => {
          if (data.create) {
            v.breadcrumbs(v => {
              v.a('Datasets', { href: '/datasets/' })
              v.iconLink('cassette', 'Create Dataset', { href: uri`/datasets/create` })
            })
          } else {
            v.breadcrumbs(v => {
              v.a('Datasets', { href: '/datasets/' })
              v.iconLink('user-circle', req.params.user, { href: uri`/users/${req.params.user}` })
              v.iconLink('cassette', req.params.name, { href: uri`/datasets/${req.params.user}:${req.params.name}/` })
            })

            v.panelTabs(
              { label: 'View', href: uri`/datasets/${req.params.user}:${req.params.name}/` },
              { label: 'Edit', href: uri`/datasets/${req.params.user}:${req.params.name}/configuration`, if: req.owner, current: true },
              { label: 'Import', href: uri`/datasets/${req.params.user}:${req.params.name}/import`, if: req.owner },
              { label: 'Export', href: uri`/datasets/${req.params.user}:${req.params.name}/export` }
            )
          }
        })

        if (data.create) {
          v.heading('Create Dataset')
        } else {
          v.heading(`Editing “${req.params.name}”`)
        }

        if (error) {
          v.p(v => { v.glitch('Error: '); v.text(error) })
        }

        v.dl({ class: ['expand'] }, v => {
          v.dt('Dataset Name')
          v.dd(v => v.input({ name: 'name', value: data.name, minlength: 1, maxlength: 250, pattern: "[^!*'();:@&=+$,/?%#[\\]]+", disabled: !data.create }))

          v.dt('Memo (short description)')
          v.dd(v => v.textarea(data.memo, { name: 'memo', spellcheck: 'true', wrap: 'off' }))
        })

        v.footer(v => {
          if (data.create) {
            v.button('Create', { type: 'submit' })
          } else {
            v.button('Save', { type: 'submit' })
            v.button('Delete', { type: 'submit', formaction: uri`/datasets/${req.params.user}:${req.params.name}`, formmethod: 'DELETE' })
          }
        })
      })
    })
  })
}
