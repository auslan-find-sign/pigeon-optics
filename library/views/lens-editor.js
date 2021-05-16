const layout = require('./layout')
const uri = require('encodeuricomponent-tag')
const { LensCodeError } = require('../models/lens')

/**
 * block to build a dataset config editor form
 * @param {Request} req - express Request
 * @param {string} data - object with state info for the form
 */
module.exports = (req, data) => {
  return layout(req, v => {
    v.form({ class: 'simple-form', method: 'PUT' }, v => {
      v.panel(v => {
        v.header(v => {
          v.breadcrumbs(v => {
            v.a('Lenses', { href: '/lenses/' })
            if (data.create) {
              v.a('Create Lens', { href: '/lenses/create' })
            } else {
              v.iconLink('user-circle', req.params.author, { href: uri`/authors/${req.params.author}/` })
              v.iconLink('3dglasses', req.params.name, { href: uri`/lenses/${req.params.author}:${req.params.name}/` })
            }
          })

          if (!data.create) {
            v.panelTabs(
              { label: 'Lens', href: uri`/lenses/${req.params.author}:${req.params.name}/` },
              { label: 'Edit', href: uri`/lenses/${req.params.author}:${req.params.name}/configuration`, if: req.owner, current: true },
              { label: 'Logs', href: uri`/lenses/${req.params.author}:${req.params.name}/logs` },
              { label: 'Export', href: uri`/lenses/${req.params.author}:${req.params.name}/export` }
            )
          }
        })

        if (data.create) v.heading('Create a Lens')
        else v.heading(`Editing Lens “${req.params.name}”`)

        if (data.error && !(data.error instanceof LensCodeError)) {
          v.p(v => { v.glitch('Error: '); v.pre(data.error.message) })
        }

        v.hiddenFormData({ owner: data.owner || req.author })
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

          v.dt('Javascript Function')
          v.dd(v => {
            v.div({
              innerHTML: `Map function receives <code>path</code> and <code>data</code>. <code>path</code> is an object
              containing <code>string</code> (full data path of input), and <code>source</code>, <code>author</code>,
              <code>name</code>, and <code>recordID</code> properties. data contains the value of the underlying
              dataset/lens output. Use <code>output(recordID, recordData)</code> to add an output to the lens.
              <code>console.log/warn/info/error()</code> is also available for debugging.`
            })
            const editorOpts = {}
            const error = data.error
            if (error instanceof LensCodeError) {
              v.stacktrace(error.object)
              const msgMatch = error.message.match(/.js:([0-9]+:[0-9]+)]$/)
              if (msgMatch[1]) editorOpts.cursor = msgMatch[1]
              if (error.stack.length > 0) {
                editorOpts.cursor = `${error.stack[0].line}:${error.stack[0].column}`
              }
            }
            v.sourceCodeEditor('code', 'javascript', data.code, editorOpts)
          })
        })

        v.footer(v => {
          v.button('Test', { type: 'submit', formmethod: 'POST', formaction: '/lenses/ephemeral' })
          if (data.create) {
            v.button('Create', { type: 'submit' })
          } else {
            v.button('Save', { type: 'submit' })
            v.button('Delete', { type: 'submit', formaction: uri`/lenses/${req.params.author}:${req.params.name}/`, formmethod: 'DELETE' })
          }
        })
      })
    })
  })
}
