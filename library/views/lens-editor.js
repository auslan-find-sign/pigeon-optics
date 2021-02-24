const layout = require('./layout')

/**
 * block to build a dataset config editor form
 * @param {Request} req - express Request
 * @param {string} data - object with state info for the form
 * @param {null|string} error - null or a string with an error message
 */
module.exports = (req, data, error = null) => {
  return layout(req, v => {
    v.panel(v => {
      v.form({ class: 'simple-form', method: 'PUT' }, v => {
        if (data.create) v.heading('Create a Lens')
        else v.heading(`Editing Lens “${req.params.name}”`)

        if (error) v.p(v => { v.glitch('Error: '); v.pre(error) })

        v.hiddenFormData({ owner: data.owner || req.session.auth.user })
        v.hiddenFormData({ mapType: data.mapType })

        v.dl(v => {
          v.dt('Lens Name')
          if (data.create) {
            v.dd(v => v.input({ name: 'name', value: data.name, minlength: 1, maxlength: 60, pattern: "[^!*'();:@&=+$,/?%#[\\]]+" }))
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
            v.p(`Map code receives recordPath string and recordData object from dataset, and can then
            call output('recordID', { complex object }) to create a lens record with the recordID as
            the entry's name. Values can be any JSON type, or Buffer, or Attachment instances to
            represent file data. Buffers should only be used for small pieces of data like hashes.
            Attachments should always be used for any large information for better performance.`)
            v.sourceCodeEditor('mapCode', 'javascript', data.mapCode)
          })

          v.dt('Javascript Reduce Function')
          v.dd(v => {
            v.p({
              innerHTML: `When map functions output the same recordID multiple times, this function
              is called with <code>left</code> and <code>right</code> values. It should combine, and return
              a single result.`
            })
            v.sourceCodeEditor('reduceCode', 'javascript', data.reduceCode)
          })
        })

        v.flexRow(v => {
          v.flexSpacer(5)
          if (data.create) {
            v.button('Create', { type: 'submit' })
          } else {
            v.button('Delete', { type: 'submit', formaction: 'DELETE' })
            v.button('Save', { type: 'submit' })
          }
        })
      })
    })
  })
}
