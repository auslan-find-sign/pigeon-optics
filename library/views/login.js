const layout = require('./layout')

/**
 * block to build a login/register form page
 * @param {Request} req - express Request
 * @param {string} mode - either 'login' or 'register'
 * @param {null|string} error - null or a string with an error message
 */
module.exports = (req, data, error = null) => {
  return layout(req, v => {
    v.form({ method: 'POST' }, v => {
      v.panel(v => {
        v.heading('Login to Pigeon Optics')

        v.hiddenFormData(Object.fromEntries(Object.entries(data).filter(([key]) => key !== 'username' && key !== 'password')))

        v.p(v => {
          v.text('Login or register an account here')
        })

        if (error) {
          v.p(v => { v.glitch('Error: '); v.text(error) })
        }

        v.dl(v => {
          v.dt('Username')
          v.dd(v => v.input({ name: 'username', value: data.username || '', minlength: 3, maxlength: 30, pattern: "[^!*'();:@&=+$,/?%#[\\]\\r\\n\\t ]+" }))

          v.dt('Password')
          v.dd(v => v.input({ name: 'password', value: data.password || '', type: 'password', minlength: 8, maxlength: 500 }))
        })
      })

      v.panelActions(
        { label: 'Register', attributes: { type: 'submit', name: 'register', value: 'true' } },
        { label: 'Login', attributes: { type: 'submit', name: 'login', value: 'true' } }
      )
    })
  })
}
