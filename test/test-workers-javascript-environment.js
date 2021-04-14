const chai = require('chai')
const { expect } = chai
const codec = require('../library/models/codec')
const JsonML = require('../library/workers/environment.js/jsonml')

const testDocument = codec.xml.decode(`<root>
  <head><title>Wonderful World of Signs</title></head>
  <body>
    <div id="heading">
      <a href="http://signs.com/">Signs Homepage</a>
    </div>
    <article>
      <p>Hello there!</p>
      <img src="foo.png"/>
      <a href="/next">Next Page</a>
    </article>
  </body>
</root>`)

describe('JsonML.select()', () => {
  it('selects <root>', () => {
    expect(JsonML.select(testDocument, 'root')).to.be.an('array').that.deep.equals([
      testDocument.JsonML
    ], 'should find the <root> element')
  })

  it('selects links', () => {
    expect(JsonML.select(testDocument, 'a[href]')).to.be.an('array').that.deep.equals([
      ['a', { href: 'http://signs.com/' }, 'Signs Homepage'],
      ['a', { href: '/next' }, 'Next Page']
    ], 'should find all the link elements')
  })

  it('selects with head > title', () => {
    expect(JsonML.select(testDocument, 'head > title')).to.be.an('array').that.deep.equals([
      ['title', { }, 'Wonderful World of Signs']
    ], 'should find the title')
  })
})

describe('JsonML.text()', () => {
  it('concats the strings of the whole document', () => {
    expect(JsonML.text(testDocument)).to.equal('Wonderful World of SignsSigns HomepageHello there!Next Page')
  })

  it('can turn a selected node in to text', () => {
    expect(JsonML.text(JsonML.select(testDocument, 'title'))).to.equal('Wonderful World of Signs')
  })
})

describe('JsonML.attr()', () => {
  it('reads attributes from elements returned by JsonML.select', () => {
    expect(JsonML.attr(JsonML.select(testDocument, 'a')[0], 'href')).to.equal('http://signs.com/')
  })

  it('reads hand crafted elements attributes', () => {
    const el = ['test-element', { val: 'just a test' }]
    expect(JsonML.attr(el, 'val')).to.equal('just a test')
  })
})

describe('JsonML.toHTML()', () => {
  it('serializes well', () => {
    const output = JsonML.toHTML(testDocument)
    expect(output).to.equal([
      '<root><head><title>Wonderful World of Signs</title></head>',
      '<body><div id=heading><a href=http://signs.com/>Signs Homepage</a></div>',
      '<article><p>Hello there!</p><img src=foo.png><a href=/next>Next Page</a></article>',
      '</body></root>'
    ].join(''))
  })

  it('throws with bad JsonML structure', () => {
    expect(() => JsonML.toHTML(false)).to.throw()
    expect(() => JsonML.toHTML([1, 2, 3])).to.throw()
    expect(() => JsonML.toHTML(['tag', [1, 2, 3]])).to.throw()
  })

  it('throws with impossible html structures', () => {
    expect(() => JsonML.toHTML(['img', { src: 'foo.jpg' }, ['child', {}]])).to.throw()
  })
})

describe('JsonML.toXML()', () => {
  it('serializes well', () => {
    const output = JsonML.toXML(testDocument)
    expect(output).to.equal([
      '<root><head><title>Wonderful World of Signs</title></head>',
      '<body><div id="heading"><a href="http://signs.com/">Signs Homepage</a></div>',
      '<article><p>Hello there!</p><img src="foo.png"/><a href="/next">Next Page</a></article>',
      '</body></root>'
    ].join(''))
  })

  it('throws with bad JsonML structure', () => {
    expect(() => JsonML.toXML(false)).to.throw()
    expect(() => JsonML.toXML([1, 2, 3])).to.throw()
    expect(() => JsonML.toXML(['tag', [1, 2, 3]])).to.throw()
  })
})
