/**
 * HTML escape an attribute value
 * @param {string} string
 * @returns {string}
 */
module.exports = function escapeAttribute (string) {
  return `${string}`
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}
