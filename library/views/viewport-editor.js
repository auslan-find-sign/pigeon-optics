const layout = require('./layout')

/**
 * block to build a dataset config editor form
 * @param {Request} req - express Request
 * @param {string} data - object with state info for the form
 * @param {null|string} error - null or a string with an error message
 */
module.exports = (req, data, error = null) => {
  return layout(req, v => {
    v.form({ class: 'simple-form', method: 'POST' }, v => {
      if (data.create) v.heading('Create a Viewport')
      else v.heading(`Editing Viewport “${req.params.name}”`)

      if (error) v.p(v => { v.glitch('Error: '); v.text(error) })

      v.hiddenFormData({ owner: data.owner || req.session.auth.user })

      v.dl(v => {
        v.dt('Viewport Name')
        if (data.create) {
          v.dd(v => v.input({ name: 'name', value: data.name, minlength: 1, maxlength: 60, pattern: "[^!*'();:@&=+$,/?%#[\\]]+" }))
        } else {
          v.dd(data.name)
          v.hiddenFormData({ name: data.name })
        }

        v.dt('Short Description')
        v.dd(v => v.textarea(data.memo, { name: 'memo', spellcheck: 'true', wrap: 'off' }))

        v.dt('Inputs (one data path per line)')
        v.dd(v => v.textarea(data.inputs, { name: 'inputs', spellcheck: 'false', wrap: 'off' }))

        v.dt('Javascript Lens')
        v.dd(v => v.input({ name: 'lens', value: data.lens, minlength: 5, maxlength: 250, pattern: '[^:]+:[^:]+' }))
      })

      v.flexRow(v => {
        v.flexSpacer(5)
        if (data.create) {
          v.button('Create', { type: 'submit' })
        } else {
          v.button('Delete', { type: 'submit', formaction: 'delete' })
          v.button('Save', { type: 'submit' })
        }
      })
    })
  })
}
