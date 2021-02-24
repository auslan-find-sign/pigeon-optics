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
    v.panel(v => {
      v.form({ method: 'PUT' }, v => {
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
            v.sourceCodeEditor('recordData', 'json', data.recordData)
          })
        })

        v.flexRow(v => {
          v.flexSpacer(5)
          if (!data.create) v.button('Delete', { type: 'submit', formmethod: 'DELETE', formaction: uri`/datasets/${req.params.user}:${req.params.name}/records/${data.recordID}` })
          v.button('Save', { type: 'submit' })
        })
      })
    })
  })
}
