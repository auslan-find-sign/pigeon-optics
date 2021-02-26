const layout = require('./layout')
const uri = require('encodeuricomponent-tag')

/**
 * block to build a dataset manual record editor
 * @param {Request} req - express Request
 * @param {string} data - object with state info for the form
 * @param {null|string} error - null or a string with an error message
 */
module.exports = (req, data, error = null) => {
  return layout(req, v => {
    v.form({ method: 'PUT' }, v => {
      if (req.owner && !data.create) {
        v.panelTabs(
          { label: 'View', href: uri`/datasets/${req.params.user}:${req.params.name}/records/${req.params.recordID}` },
          { label: 'Edit', href: uri`/datasets/${req.params.user}:${req.params.name}/records/${req.params.recordID}?edit=1`, current: true }
        )
      }

      v.panel(v => {
        v.breadcrumbs(v => {
          v.a('Home', { href: '/' })
          v.a('Datasets', { href: '/datasets/' })
          v.iconLink('user-circle', req.params.user, { href: uri`/users/${req.params.user}` })
          v.iconLink('cassette', req.params.name, { href: uri`/datasets/${req.params.user}:${req.params.name}/` })
          if (data.create) {
            v.iconLink('newspaper', 'Add Record', { href: uri`/datasets/${req.params.user}:${req.params.name}/create-record` })
          } else {
            v.iconLink('newspaper', req.params.recordID, { href: uri`/datasets/${req.params.user}:${req.params.name}/records/${req.params.recordID}` })
          }
        })

        if (data.create) {
          v.heading('Create Dataset Record')
        } else {
          v.heading(`Editing “${data.recordID}”`)
        }

        if (error) {
          v.p(v => { v.glitch('Error: '); v.text(error) })
        }

        v.dl(v => {
          v.dt('Record ID')
          if (data.create) {
            v.dd(v => v.input({ name: 'recordID', value: data.recordID, minlength: 1, maxlength: 250, autocomplete: 'off' }))
          } else {
            v.dd(data.recordID)
          }

          v.dt('Data (JSON)')
          v.dd(v => {
            v.sourceCodeEditor('recordData', 'json5', data.recordData)
          })
        })
      })

      v.panelActions(
        { label: 'Save', attributes: { type: 'submit' } },
        !data.create && { label: 'Delete', attributes: { type: 'submit', formmethod: 'DELETE', formaction: uri`/datasets/${req.params.user}:${req.params.name}/records/${data.recordID}` } }
      )
    })
  })
}
