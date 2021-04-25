const hp2 = require('htmlparser2')

module.exports = function decode (string) {
  const root = ['#root']
  let stack = [root]
  const top = () => stack[0]
  const push = (data) => {
    top().push(data)
    stack.unshift(data)
  }
  const pop = (name) => {
    const found = stack.find(v => v[0] === name)
    stack = stack.filter(v => v !== found)
  }

  const parser = new hp2.Parser({
    onprocessinginstruction (name, data) { stack.push(['#processing-instruction', name, data]) },
    ontext (string) {
      const parent = top()
      if (parent.length > 1 && typeof parent[parent.length - 1] === 'string') {
        parent[parent.length - 1] = parent[parent.length - 1] + string
      } else {
        parent.push(string)
      }
    },

    onopentag (name, attributes) {
      if (Object.keys(attributes).length > 0) {
        push([name, attributes])
      } else {
        push([name])
      }
    },
    onclosetag (name) { pop(name) },

    oncomment (string) {
      if (string.startsWith('[CDATA[') && string.endsWith(']]')) {
        push(['#cdata-section', string.slice('[CDATA['.length, -']]'.length)])
      } else {
        push(['#comment', string])
      }
    },
    oncommentend () { pop('#comment') },

    oncdatastart () { push(['#cdata-section']) },
    oncdataend () { pop('#cdata-section') },

    onerror (err) { throw err }
  }, { xmlMode: false, decodeEntities: true })

  parser.end(string)

  // find <html> in root?
  const html = root.find(v => Array.isArray(v) && v[0].toLowerCase() === 'html')
  if (html) {
    return { JsonML: html }
  } else if (root.length === 2) {
    return root[1]
  } else {
    return ['#document-fragment', ...root.slice(1)]
  }
}
