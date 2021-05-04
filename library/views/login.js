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
        v.header(v => {
          v.breadcrumbs(v => v.a('Login', { href: '/auth' }))
        })

        v.heading('Login to Pigeon Optics')

        if (data.return) {
          v.hiddenFormData({ return: data.return })
        }

        v.p(v => {
          v.text('Login or register an account here')
        })

        if (error) {
          v.p(v => { v.glitch('Error: '); v.text(error) })
        }

        v.dl(v => {
          v.dt('Name')
          v.dd(v => v.input({ name: 'name', value: data.name || '', minlength: 3, maxlength: 30, pattern: "[^!*'();:@&=+$,/?%#[\\]\\r\\n\\t\\0]+" }))

          v.dt('Password')
          v.dd(v => v.input({ name: 'password', value: data.password || '', type: 'password', minlength: 8, maxlength: 500 }))
        })

        v.footer(v => {
          v.button('Login', { type: 'submit', name: 'login', value: 'true' })
          v.button('Register', { type: 'submit', name: 'register', value: 'true' })
        })
      })
    })
  })
}
