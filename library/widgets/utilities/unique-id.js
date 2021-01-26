const codetable = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_$'.split('')
function uniqueID(length = 12) {
  let str = []
  while (str.length < length) {
    str.push(codetable[Math.round(Math.random() * (codetable.length - 1))])
  }
  return str.join('')
}

module.exports = uniqueID
