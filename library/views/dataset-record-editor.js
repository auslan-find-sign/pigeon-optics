const layout = require('./layout')

/**
 * block to build a login/register form page
 * @param {Request} req - express Request
 * @param {string} mode - either 'login' or 'register'
 * @param {null|string} error - null or a string with an error message
 */
module.exports = (req, data, error = null) => {
  return layout(req, v => {
    v.form({ class: 'simple-form', method: 'POST' }, v => {
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
          v.dd(v => v.input({ name: 'recordID', value: data.recordID, minlength: 1, maxlength: 250 }))
        } else {
          v.dd(data.recordID)
        }

        v.dt('Data (JSON)')
        v.dd(v => v.textarea(data.recordData, { name: 'recordData', spellcheck: 'false', wrap: 'off' }))
      })

      v.flexRow(v => {
        v.flexSpacer(5)
        if (!data.create) v.button('Delete', { type: 'submit', formaction: 'delete' })
        v.button('Save', { type: 'submit', formaction: 'save' })
      })
    })
  })
}
