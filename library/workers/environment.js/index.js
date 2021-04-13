// Environment script, establishes any APIs available inside of the javascript lens virtual machine
// This script is run through browserify to embed libraries like css-select
Math.random = function () {
  throw new Error('Math.random() is unavailable. Lenses must be deterministic, not random')
}

global.JsonML = require('./jsonml')
