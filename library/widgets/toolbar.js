// Toolbar is a styled version of the flex row, with a few differences. If a toolbar control is an integer
// Number, it will automatically be converted to a Spring to create a seperation area

const FlexRow = require('./flex-row')
const Nanocomponent = require('nanocomponent')
const html = require('nanohtml')
const StyleObject = require('@bluebie/style-object')

class Toolbar extends FlexRow {
  constructor ({ contents = [], style = {} }) {
    super({ contents, style, justify: 'space-between' })
  }
  
  // for live syncing support
  getConstructorOptions () {
    return { contents: this.contents }
  }
}

module.exports = Toolbar