const fs = require('fs-extra')
const codec = require('./codec')
const onDeath = require('death')

const defaults = require('../../package.json').defaults
const settingsPath = `${defaults.data}/settings.json`

Object.assign(exports, defaults)
try {
  Object.assign(exports, codec.json.decode(fs.readFileSync(settingsPath)))
} catch (err) {
  // No-op
}

// save any changes on exit
onDeath(() => {
  fs.writeFileSync(settingsPath, codec.json.encode(exports, 2))
  process.exit()
})
