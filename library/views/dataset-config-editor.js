const layout = require('./layout')

/**
 * block to build a dataset config editor form
 * @param {Request} req - express Request
 * @param {string} data - object with state info for the form
 * @param {null|string} error - null or a string with an error message
 */
module.exports = (req, data, error = null) => {
  return layout(req, v => {
    v.form({ class: 'simple-form', method: 'POST', action: data.create ? 'create' : 'save' }, v => {
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
        if (data.create) {
          v.dd(v => v.input({ name: 'name', value: data.name, minlength: 1, maxlength: 60, pattern: "[^!*'();:@&=+$,/?%#[\\]]+" }))
        } else {
          v.dd(data.name)
        }

        v.dt('Memo (short description)')
        v.dd(v => v.textarea(data.memo, { name: 'memo', spellcheck: 'true', wrap: 'off' }))
      })

      v.flexRow(v => {
        v.flexSpacer(5)
        if (data.create) {
          v.button('Create', { type: 'submit', formaction: 'create' })
        } else {
          v.button('Delete', { type: 'submit', formaction: 'delete' })
          v.button('Save', { type: 'submit', formaction: 'save' })
        }
      })
    })
  })
}
