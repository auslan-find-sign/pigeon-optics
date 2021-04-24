module.exports = function domToJsonML (element) {
  if (element.nodeName === '#document') {
    return { JsonML: domToJsonML(element.childNodes.find(x => !x.nodeName.startsWith('#'))) }
  } else if (element.nodeName === '#document-fragment') {
    return ['#document-fragment', ...element.childNodes.map(domToJsonML)]
  } else if (element.nodeName === '#comment') {
    // p5 doesn't know how to parse cdata
    if (element.data.startsWith('[CDATA[') && element.data.endsWith(']]')) {
      return ['#cdata-section', element.data.slice(7, -2)]
    } else {
      return ['#comment', element.data]
    }
  } else if (element.nodeName === '#text') {
    return element.value.trim()
  } else if (!element.nodeName.startsWith('#')) {
    // regular element
    const attrs = element.attrs.map(attr => [attr.prefix ? `${attr.prefix}:${attr.name}` : attr.name, attr.value])
    const children = element.childNodes.map(domToJsonML).filter(x => x)
    if (attrs.length > 0) {
      return [element.tagName, Object.fromEntries(attrs), ...children]
    } else {
      return [element.tagName, ...children]
    }
  }
}
