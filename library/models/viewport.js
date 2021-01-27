/**
 * Viewports are instances of lenses which are established and exist on the system. Viewports run
 * automatically and have a precomputed output that is written to disk. Viewport outputs exist
 * in the changelog and can be used as inputs to other viewports or potentially monitored by external
 * observers for changes
 */
const auth = require('./auth')
const jsLens = require('./javascript-lens')
const webhook = require('../workers/webhook')
const dataset = require('./dataset')
const readPath = require('./read-path')
const defaults = require('../../package.json').defaults

module.exports = {
  ...dataset, // import dataset functions

  // resolve path inside this - override with viewports path in user folder
  path (user, ...path) {
    return `${auth.userFolder(user)}/viewports${path.map(x => `/${encodeURIComponent(x)}`).join('')}`
  },

  /** Load a viewport
   * @param {string} user - owner of viewport
   * @param {string} viewport - name of viewport under user
   * @returns {Viewport}
   */
  async load (user, viewport) {
    const config = await this.readConfig(user, viewport)
    let getFilter

    if (config.type === 'javascript') {
      getFilter = () => {
        return jsLens.load(config.lensUser, config.lensName, {}, defaults.lensTimeout)
      }
    } else if (config.type === 'webhook') {
      getFilter = () => {
        return webhook(config.webhookURL, user, viewport, config.webhookFormat)
      }
    }

    const vp = new Viewport({ user, name: viewport, inputs: config.inputs, getFilter })

    return vp
  }
}

class Viewport {
  // user is owner of viewport
  // name is name of viewport
  // inputs is an array of strings, which match changelog paths like /dataset/user:datasetName/entryID
  // getFilter is a function which returns a promise that resolves with a JSLens or something that
  // implements the same interface
  constructor ({ user, name, inputs, getFilter }) {
    this.user = user
    this.name = name
    this.inputs = inputs
    this.getFilter = getFilter
  }

  async onChange (changeLog) {
    let filter = null
    for (const change of changeLog) {
      if (this.inputs.some(path => change.path.startsWith(path))) {
        // match! load the filter if needed
        if (filter === null) filter = await this.getFilter()

        // lookup the thing which changed
        const input = await readPath(change.path)
        const lookups = {}

        const lookupPaths = filter.lookup(change.path, input)
        if (lookupPaths && Array.isArray(lookupPaths)) {
          await Promise.all(lookupPaths.map(async lookup => {
            const lookedUp = await readPath(lookup)
            lookups[lookup] = lookedUp
          }))
        }

        filter.transform(change.path, input)
      }
    }
  }
}

module.exports.Viewport = Viewport
