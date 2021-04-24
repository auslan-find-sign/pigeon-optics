// does html encoding escaping to strings in the most minimally invasive way possible, including ambiguous ampersand logic
module.exports = function esc (string, replaceList) {
  const table = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }
  return string.replace(/(&[#a-zA-Z0-9][a-zA-Z0-9]*;|[<>"'])/g, match => {
    const char = match[0]
    return (replaceList.includes(char) ? table[char] : char) + match.slice(1)
  })
}
