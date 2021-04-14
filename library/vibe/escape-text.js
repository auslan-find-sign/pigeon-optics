/**
 * Escape a string for use as text inside html
 * @param {string} string
 * @returns {string}
 */
module.exports = function escapeText (string) {
  return `${string}`
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
}
