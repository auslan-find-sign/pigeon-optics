// returns number of occurances of a search character within string
module.exports = function countChars (string, char) {
  return Array.prototype.reduce.call(string, (prev, x) => x === char ? prev + 1 : prev, 0)
}
