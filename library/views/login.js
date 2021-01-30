const layout = require('./layout')

/**
 * block to build a login/register form page
 * @param {Request} req - express Request
 * @param {string} mode - either 'login' or 'register'
 * @param {null|string} error - null or a string with an error message
 */
module.exports = (req, data, error = null) => {
  return layout(req, v => {
    v.form({ class: 'simple-form', method: 'POST', action: 'login' }, v => {
      v.heading('Login to Datasets')

      v.hiddenFormData(Object.fromEntries(Object.entries(data).filter(([key]) => key !== 'username' && key !== 'password')))

      v.p(v => {
        v.text('Login or register an account here')
      })

      if (error) {
        v.p(v => { v.glitch('Error: '); v.text(error) })
      }

      v.dl(v => {
        v.dt('Username')
        v.dd(v => v.input({ name: 'username', value: data.username || '', minlength: 3, maxlength: 30, pattern: "[^!*'();:@&=+$,/?%#[\\]\r\n\t ]+" }))

        v.dt('Password')
        v.dd(v => v.input({ name: 'password', value: data.password || '', type: 'password', minlength: 8, maxlength: 500 }))
      })

      v.flexRow(v => {
        v.flexSpacer(5)
        v.button('Register', { type: 'submit', formaction: 'register' })
        v.button('Login', { type: 'submit', formaction: 'login' })
      })
    })
  })
}
