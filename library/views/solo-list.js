const layout = require('./layout')
const uri = require('encodeuricomponent-tag')

/**
 * @param {Request} req - express Request
 * @param {string} heading - text for heading
 * @param {string} data - object with state info for the form
 * @param {function} [getURL] - function which returns a string url for the link to go to
 */
module.exports = (req, heading, data, getURL = (x) => uri`${x}`) => {
  return layout(req, async v => {
    v.heading(heading)
    await v.linkList(data, getURL)
  })
}
