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
    v.form({ class: 'simple-form', method: 'PUT' }, v => {
      v.panel(v => {
        v.header(v => {
          v.breadcrumbs(v => {
            v.a('Lenses', { href: '/lenses/' })
            if (data.create) {
              v.a('Create Lens', { href: '/lenses/create' })
            } else {
              v.iconLink('user-circle', req.params.user, { href: uri`/users/${req.params.user}/` })
              v.iconLink('3dglasses', req.params.name, { href: uri`/lenses/${req.params.user}:${req.params.name}/` })
            }
          })

          if (!data.create) {
            v.panelTabs(
              { label: 'Lens', href: uri`/lenses/${req.params.user}:${req.params.name}/` },
              { label: 'Edit', href: uri`/lenses/${req.params.user}:${req.params.name}/configuration`, if: req.owner, current: true },
              { label: 'Logs', href: uri`/lenses/${req.params.user}:${req.params.name}/logs` },
              { label: 'Export', href: uri`/lenses/${req.params.user}:${req.params.name}/export` }
            )
          }
        })

        if (data.create) v.heading('Create a Lens')
        else v.heading(`Editing Lens “${req.params.name}”`)

        if (error) v.p(v => { v.glitch('Error: '); v.pre(error) })

        v.hiddenFormData({ owner: data.owner || req.session.auth.user })
        v.hiddenFormData({ mapType: data.mapType })

        v.dl(v => {
          v.dt('Lens Name')
          if (data.create) {
            v.dd(v => v.input({ name: 'name', value: data.name, minlength: 1, maxlength: 250, pattern: "[^!*'();:@&=+$,/?%#[\\]]+" }))
          } else {
            v.dd(data.name)
            v.hiddenFormData({ name: data.name })
          }

          v.dt('Short Description')
          v.dd(v => v.textarea(data.memo, { name: 'memo', spellcheck: 'true', wrap: 'off' }))

          v.dt('Inputs (one data path per line)')
          v.dd(v => v.textarea([data.inputs].flat().join('\n'), { name: 'inputs', spellcheck: 'false', wrap: 'off' }))

          v.dt('Javascript Map Function')
          v.dd(v => {
            v.div({
              innerHTML: `Map function receives <code>path</code> and <code>data</code>. <code>path</code> is an object
              containing <code>string</code> (full data path of input), and <code>source</code>, <code>user</code>,
              <code>name</code>, and <code>recordID</code> properties. data contains the value of the underlying
              dataset/lens output. Use <code>output(recordID, recordData)</code> to add an output to the lens.
              <code>console.log/warn/info/error()</code> is also available for debugging.`
            })
            v.sourceCodeEditor('mapCode', 'javascript', data.mapCode)
          })

          v.dt('Javascript Reduce Function')
          v.dd(v => {
            v.div({
              innerHTML: `When map functions output the same recordID multiple times, this function
              is called with <code>left</code> and <code>right</code> values. It should combine, and return
              a single result.`
            })
            v.sourceCodeEditor('reduceCode', 'javascript', data.reduceCode)
          })
        })

        v.footer(v => {
          v.button('Test', { type: 'submit', formmethod: 'POST', formaction: '/lenses/ephemeral' })
          if (data.create) {
            v.button('Create', { type: 'submit' })
          } else {
            v.button('Save', { type: 'submit' })
            v.button('Delete', { type: 'submit', formaction: uri`/lenses/${req.params.user}:${req.params.name}/`, formmethod: 'DELETE' })
          }
        })
      })
    })
  })
}
