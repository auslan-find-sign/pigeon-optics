const layout = require('./layout')

/**
 * block to build a javascript lens editor form
 * @param {Request} req - express Request
 * @param {string} data - object with name, mapCode, and mergeCode properties, optionally create can be true
 * @param {null|string} error - null or a string with an error message
 */
module.exports = (req, data, error = null) => {
  return layout(req, v => {
    v.form({ class: 'simple-form', method: 'POST' }, v => {
      if (data.create) {
        v.heading('Create a Javascript Lens')
      } else {
        v.heading(`Editing lens “${data.name}”`)
      }

      v.p(`Map code receives recordPath string and recordData object from dataset, and can then
      call output('recordID', { complex object }) to create a viewport record with the set ID string
      and complex object data, which can include any JSON types, and also can include Attachment,
      AttachmentReference, or Buffer.`)

      v.p(`If your map calls output with the same recordID string multiple times, the server will
      also run your Merge Function code, which receives 'left' and 'right' objects. These can be
      the return value of a merge function call itself, or they can be the second argument to output()
      from a map execution. If you're changing the root value's type, beware of this. Merge does not
      run when there is only one value outputted by Map code with that recordID`)

      if (error) {
        v.p(v => { v.glitch('Error: '); v.text(error) })
      }

      v.dl(v => {
        v.dt('Lens Name')
        if (data.create) {
          v.dd(v => v.input({ name: 'name', value: data.name, minlength: 1, maxlength: 250 }))
        } else {
          v.dd(data.name)
        }

        v.dt('Map Code (Javascript)')
        v.dd(v => v.textarea(data.mapCode, { name: 'mapCode', spellcheck: 'false', wrap: 'off' }))

        v.dt('Merge Code (Javascript)')
        v.dd(v => v.textarea(data.mergeCode, { name: 'mergeCode', spellcheck: 'false', wrap: 'off' }))
      })

      v.flexRow(v => {
        v.flexSpacer(5)
        if (!data.create) v.button('Delete', { type: 'submit', formaction: 'delete' })
        v.button('Save', { type: 'submit', formaction: 'save' })
      })
    })
  })
}
