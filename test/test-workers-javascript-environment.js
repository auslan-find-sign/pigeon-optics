const chai = require('chai')
const { expect } = chai
const codec = require('../library/models/codec')
const Markup = require('../library/workers/environment.js/markup')

const testDocumentText = `<!DOCTYPE html>
<html>
<head><title>Wonderful World of Signs</title></head>
<body>
  <div id="heading">
    <a href="http://signs.com/">Signs Homepage</a>
  </div>
  <article>
    <p>Hello there!</p>
    <img src="foo.png"/>
    <a href="/next">Next Page</a>
    <!-- just a silly comment -->
  </article>
</body>
</html>`

const testDocument = codec.html.decode(testDocumentText)

describe('Markup.select()', () => {
  it('selects <html>', () => {
    expect(Markup.select(testDocument, 'html')).to.be.an('array').that.deep.equals([
      testDocument[2]
    ], 'should find the <html> element')
  })

  it('selects links', () => {
    expect(Markup.select(testDocument, 'a[href]')).to.be.an('array').that.deep.equals([
      ['a', { href: 'http://signs.com/' }, 'Signs Homepage'],
      ['a', { href: '/next' }, 'Next Page']
    ], 'should find all the link elements')
  })

  it('selects with head > title', () => {
    expect(Markup.select(testDocument, 'head > title')).to.be.an('array').that.deep.equals([
      ['title', 'Wonderful World of Signs']
    ], 'should find the title')
  })
})

describe('Markup.get.text()', () => {
  it('concats the strings of the whole document', () => {
    expect(Markup.get.text(testDocument)).to.equal([
      '\nWonderful World of Signs\n\n',
      '  \n',
      '    Signs Homepage\n',
      '  \n',
      '  \n',
      '    Hello there!\n',
      '    \n',
      '    Next Page\n',
      '    \n',
      '  \n',
      '\n'
    ].join(''))
  })

  it('can turn a selected node in to text', () => {
    expect(Markup.get.text(Markup.select(testDocument, 'title')[0])).to.equal('Wonderful World of Signs')
  })
})

describe('Markup.get.attribute()', () => {
  it('reads attributes from elements returned by JsonML.select', () => {
    expect(Markup.get.attribute(Markup.select(testDocument, 'a')[0], 'href')).to.equal('http://signs.com/')
  })

  it('reads hand crafted elements attributes', () => {
    const el = ['test-element', { val: 'just a test' }]
    expect(Markup.get.attribute(el, 'val')).to.equal('just a test')
  })
})

describe('Markup.toHTML()', () => {
  it('serializes well', () => {
    const output = Markup.toHTML(testDocument)
    expect(output).to.equal([
      '<!DOCTYPE html>\n',
      '<html>\n',
      '<head><title>Wonderful World of Signs</title></head>\n',
      '<body>\n',
      '  <div id=heading>\n',
      '    <a href=http://signs.com/>Signs Homepage</a>\n',
      '  </div>\n',
      '  <article>\n',
      '    <p>Hello there!</p>\n',
      '    <img src=foo.png>\n',
      '    <a href=/next>Next Page</a>\n',
      '    <!-- just a silly comment -->\n',
      '  </article>\n',
      '</body>\n',
      '</html>'
    ].join(''))
  })

  it('throws with bad JsonML structure', () => {
    expect(() => Markup.toHTML(false)).to.throw()
    expect(() => Markup.toHTML([1, 2, 3])).to.throw()
    expect(() => Markup.toHTML(['tag', [1, 2, 3]])).to.throw()
  })

  it('throws with impossible html structures', () => {
    expect(() => Markup.toHTML(['img', { src: 'foo.jpg' }, ['child', {}]])).to.throw()
  })
})

describe('Markup.toXML()', () => {
  it('serializes well', () => {
    expect(Markup.toXML(testDocument)).to.equal(testDocumentText)
  })

  it('throws with bad JsonML structure', () => {
    expect(() => Markup.toXML(false)).to.throw()
    expect(() => Markup.toXML([1, 2, 3])).to.throw()
    expect(() => Markup.toXML(['tag', [1, 2, 3]])).to.throw()
  })
})
