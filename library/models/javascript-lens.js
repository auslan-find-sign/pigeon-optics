/**
 * This provides storage of javascript lenses, and can execute lenses too
 * Javascript lenses are sandboxed untrusted js code which can generate new views on existing data
 */
const file = require('./cbor-file')
const auth = require('./auth')
const { VM, VMScript } = require('vm2')

module.exports = {
  /** returns a list of lenses the user has created
   * @param {string} username - username of target user
   * @returns {string[]} - lens names array
   */
  async list (user) {
    return await file.list(`${auth.userFolder(user)}/javascript-lenses`)
  },

  /** writes a lens to the user's data folder
   * @param {string} username - string username
   * @param {string} lens - string name of lens
   * @param {string} lookupCode - lens code which returns an array of datasets/views to query
   * @param {string} transformCode - lens code which returns an array of outputs
   * @async
   */
  async write (user, lens, lookupCode, transformCode) {
    await file.write(`${auth.userFolder(user)}/javascript-lenses/${encodeURIComponent(lens)}/lens`, {
      lookupCode,
      transformCode,
      updated: Date.now()
    })
  },

  /** reads a lens to from user's data folder
   * @param {string} username - string username
   * @param {string} lens - string name of lens
   * @returns {string} - javascript code
   * @async
   */
  async read (user, lens) {
    await file.read(`${auth.userFolder(user)}/javascript-lenses/${encodeURIComponent(lens)}/lens`)
  },

  /** delete a lens to from user's data folder
   * @param {string} username - string username
   * @param {string} lens - string name of lens
   * @async
   */
  async delete (user, lens) {
    await file.delete(`${auth.userFolder(user)}/javascript-lenses/${encodeURIComponent(lens)}`)
  },

  /** Return value of javascriptLens.load, containing lookup and transform functions
   * @typedef {Object} JSLens
   * @property {function} lookup - function(path, input) runs user supplied lookup code in a sandboxed VM, expects dataset entry or lens output as "input" argument
   * @property {function} transform - function(path, input, lookups) expects input record from dataset or lens, and lookups should be an object containing stuff requested by the lookup function
   */

  /** execute a javascript lens against an input data
   * @param {string} username - user who owns lens
   * @param {string} lens - name of javascript lens
   * @param {object} globals - object with any extra globals to inject
   * @param {number} timeout - how many milliseconds should this run for before giving up and throwing an error? default 10ms
   * @returns {JSLens} - object with lookup and transform functions that can be run at any time
   * @async
   */
  async load (user, lens, globals = {}, timeout = 10) {
    // read in the script's code
    const code = await module.exports.read(user, lens)
    // create a VM for this script to run in
    const vm = new VM({ timeout, sandbox: { }, eval: false, wasm: false, fixAsync: true })
    // add lens metadata as a frozen global in the VM
    vm.freeze({ owner: user, name: lens }, 'lens')
    // add in any globals
    vm.setGlobals(globals)
    // create a VMScript compiled instance
    const lookupScript = new VMScript(code.lookupCode)
    const transformScript = new VMScript(code.transformCode)
    // create executor function and return it
    return {
      lookup: (path, input) => {
        // make input document available to the script
        vm.setGlobal('input', input)
        vm.setGlobal('inputID', inputID)
        // return the results of running the script
        return vm.run(lookupScript)
      },
      transform: (path, input, lookups) => {
        // make input document available to the script
        vm.setGlobal('input', input)
        vm.setGlobal('path', path)
        vm.setGlobal('lookups', lookups)
        // return the results of running the script
        return vm.run(transformScript)
      }
    }
  }
}
