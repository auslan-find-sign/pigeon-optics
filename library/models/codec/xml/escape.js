// does html encoding escaping to strings
module.exports = function esc (string, replaceList) {
  const table = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }
  return string.replace(/[&<>"']/g, char => replaceList.includes(char) ? table[char] : char)
}
