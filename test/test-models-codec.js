const codec = require('../library/models/codec')
const { expect } = require('chai')
const { Readable } = require('stream')
const asyncIterableToArray = require('../library/utility/async-iterable-to-array')
const typeDetect = require('type-detect')
const baseEncDecImpl = require('../library/models/codec/base-encoder-decoder-impl')

const unicodeStrings = [
  'بِسْمِ ٱللّٰهِ ٱلرَّحْمـَبنِ ٱلرَّحِيمِ', // arabic
  'ஸ்றீனிவாஸ ராமானுஜன் ஐயங்கார்', // tamil
  '子曰：「學而時習之，不亦說乎？有朋自遠方來，不亦樂乎？', // chinese
  'पशुपतिरपि तान्यहानि कृच्छ्राद् ', // sanskrit
  'Ἰοὺ ἰού· τὰ πάντʼ ἂν ἐξήκοι σαφῆ. ', // greek
  'По оживлённым берегам ', // russian
  '♖ ♘ ♗ ♕ ♔ ♗ ♘ ♖', // chess
  '👋🤚🖐✋🖖👌🤌🤏🤞🤟🤘🤙👈👉👆🖕👇👍👎✊👊🤛🤜👏🙌👐🤲🤝', // plain emoji
  '👋🏽🤚🏽🖐🏽✋🏽🖖🏽👌🏽🤌🏽🤏🏽✌🏽🤞🏽🤟🏽🤘🏽🤙🏽👈🏽👉🏽👆🏽🖕🏽👇🏽' // skin tone emoji
]

const tests = [
  true,
  false,
  5,
  9274,
  0.0001,
  [1, 2, 3],
  [null, null, undefined, null],
  [null, true, false, Infinity, -Infinity, NaN], // test extended types
  // undefined,
  null,
  Buffer.from('hello world'),
  { a: 1, b: 2 },
  { 1: false, 2: true },
  new Set([1, 2, 3, 'a', 'b', 'c']),
  new Map([['a', 1], [2, '3'], [true, 9]]),
  {
    foo: [1, 2, 3, null, 5],
    bar: {
      1: 'yes',
      2: 'no',
      g: 'maybe'
    },
    bools: [true, false],
    buffery: Buffer.from('hello world')
  },
  ['element', { name: 'foo' }, 'text node', ['subel', { name: 'bar' }], 'after text node'],
  [
    { a: 1, b: 2, c: { a: 'wep', b: false, g: { bar: 'recursive hell', f: [1, 2, [{ u: false, j: true }, 3, 4, 5]] } } },
    [1, 2, 3, 4, 5, [1, 2, 3, 4, [9, 8, 7, 6], [2, 5, 6, 8, { a: true, b: false }]]]
  ],
  ...unicodeStrings
]

function * getCodecsByFeatures (...hasFunctions) {
  for (const [label, object] of Object.entries(codec)) {
    if (!Array.isArray(object.handles)) continue
    if (hasFunctions.every(name => typeof object[name] === 'function')) {
      yield [label, object]
    }
  }
}

describe('models/codec/base-encoder-decoder-impl', function () {
  this.timeout(100)

  it('encoder()', async () => {
    function encodeIterable (input) {
      async function * gen () { yield * input }
      return Readable.from(gen(), { objectMode: false })
    }
    const enc = baseEncDecImpl.encoder.call({ encodeIterable })
    expect(enc).to.have.property('pipe')
    const res = Readable.from('abcdefghijklmnopqrstuvwxyz'.split(''), { objectMode: true }).pipe(enc)
    const output = await asyncIterableToArray(res)
    expect(Buffer.concat(output).toString('utf-8')).to.equal('abcdefghijklmnopqrstuvwxyz')
  })

  it('encoder({ wrap: true })', async () => {
    function encodeIterable (input) {
      async function * gen () { yield * input }
      return Readable.from(gen(), { objectMode: false })
    }
    const enc = baseEncDecImpl.encoder.call({ encodeIterable }, { wrap: true })
    expect(enc).to.have.property('pipe')
    const res = Readable.from('abcdefghijklmnopqrstuvwxyz'.split('').map(value => ({ value })), { objectMode: true }).pipe(enc)
    const output = await asyncIterableToArray(res)
    expect(Buffer.concat(output).toString('utf-8')).to.equal('abcdefghijklmnopqrstuvwxyz')
  })

  it('decoder()', async () => {
    async function * decodeStream (stream) { for await (const x of stream) yield x.toString() }
    const res = Readable.from(['a', 'b', 'c', 'd'], { objectMode: false })
    const dec = baseEncDecImpl.decoder.call({ decodeStream })
    res.pipe(dec)
    expect(dec).to.have.property('pipe')
    const output = await asyncIterableToArray(dec)
    expect(output.join('')).to.equal('abcd')
  })

  it('decoder({ wrap: true })', async () => {
    async function * decodeStream (stream) { for await (const x of stream) yield x.toString() }
    const res = Readable.from('abcdefghijklmnopqrstuvwxyz'.split(''), { objectMode: false })
    const dec = baseEncDecImpl.decoder.call({ decodeStream }, { wrap: true })
    res.pipe(dec)
    expect(dec).to.have.property('pipe')
    const output = await asyncIterableToArray(dec)
    expect(output.map(x => x.value).join('')).to.equal('abcdefghijklmnopqrstuvwxyz')
  })
})

describe('models/codec formats common interface', function () {
  this.timeout(100)

  for (const [label, format] of getCodecsByFeatures('encode', 'decode')) {
    if (['jsonLines', 'html'].includes(label)) continue // not general codecs (yet), special case

    it(`solo ${label} encode() > decode() roundtrip`, function () {
      for (const obj of tests) {
        try {
          const rt = format.decode(format.encode(obj))
          expect(rt).to.deep.equal(obj)
        } catch (err) {
          err.stack = `testing ${typeDetect(obj)}\n${err.stack}`
          throw err
        }
      }
    })

    if (format.print) {
      it(`solo ${label} print() > decode() roundtrip`, function () {
        for (const obj of tests) {
          const rt = format.decode(format.print(obj))
          expect(rt).to.deep.equal(obj)
        }
      })
    }
  }

  for (const [label, format] of getCodecsByFeatures('encoder', 'decoder')) {
    it(`stream ${label} encoder() > decoder() roundtrip`, async function () {
      const encoderStream = Readable.from(tests.map(value => ({ value }))).pipe(format.encoder({ wrap: true }))
      const decoderStream = encoderStream.pipe(format.decoder({ wrap: true }))
      const output = await asyncIterableToArray(decoderStream)
      expect(output).to.deep.equal(tests.map(value => ({ value })))
    })

    if (label === 'json') {
      // test json's object root streaming decoder
      it(`stream ${label} decoder() handles object at root well`, async function () {
        const entriesTest = tests.map((x, i) => [`prop${i + 1}`, x])
        const objTest = Object.fromEntries(entriesTest)
        const encoded = format.encode(objTest)
        const input = Readable.from(encoded, { objectMode: false })
        const output = await asyncIterableToArray(input.pipe(format.decoder()))
        expect(Object.fromEntries(output)).to.deep.equal(objTest)
      })

      // test json object root streaming encoder object output
      it(`stream ${label} encoder() can build root objects`, async function () {
        const entriesTest = tests.map((x, i) => [`prop${i + 1}`, x])
        const input = Readable.from(entriesTest, { objectMode: true })
        const enc = input.pipe(format.encoder({ object: true }))
        const output = Buffer.concat(await asyncIterableToArray(enc)).toString('utf-8')
        const decode = format.decode(output)
        expect(decode).to.deep.equal(Object.fromEntries(entriesTest))
      })
    }
  }

  // test encodeIterable into decoder
  for (const [label, format] of getCodecsByFeatures('encodeIterable', 'decoder')) {
    it(`iterator/stream ${label} encodeIterable > decoder roundtrip`, async function () {
      const stream = await format.encodeIterable(tests)
      expect(stream).to.have.property('pipe')
      const decoded = await asyncIterableToArray(stream.pipe(format.decoder({ wrap: true })))
      expect(decoded).to.deep.equal(tests.map(value => ({ value })))
    })
  }

  for (const [label, format] of getCodecsByFeatures('encoder', 'decodeStream')) {
    it(`iterator/stream ${label} encoder > decodeStream roundtrip`, async function () {
      const encoderStream = Readable.from(tests.map(value => ({ value }))).pipe(format.encoder({ wrap: true }))
      expect(encoderStream).to.have.property('pipe')
      const decoded = await asyncIterableToArray(await format.decodeStream(encoderStream))
      expect(decoded).to.deep.equal(tests)
    })
  }

  // test iterableToStream into streamToIterable roundtrip
  for (const [label, format] of getCodecsByFeatures('encodeIterable', 'decodeStream')) {
    it(`iterator ${label} iterableToStream > streamToIterable roundtrip`, async function () {
      const stream = await format.encodeIterable(tests)
      expect(stream).to.be.instanceOf(Readable)
      const decoded = await asyncIterableToArray(format.decodeStream(stream))
      expect(decoded).to.deep.equal(tests)
    })
  }
})

describe('models/codec.jsonLines', function () {
  it('encodes list reversably', function () {
    const roundtripped = codec.jsonLines.decode(codec.jsonLines.encode(tests))
    expect(roundtripped).to.deep.equal(tests)
  })

  it('encodes objects in to entries lists', function () {
    const test = { a: 1, b: 2, 3: 4 }
    const roundtripped = codec.jsonLines.decode(codec.jsonLines.encode(test))
    expect(Object.fromEntries(roundtripped)).to.deep.equal(test)
  })

  it('encodes root primitive types as normal json', function () {
    for (const test of [1, 2, 3, true, false, null, 'hello']) {
      const jsonDecode = codec.json.decode(codec.jsonLines.encode(test))
      expect(jsonDecode).to.equal(test)
      const roundtripped = codec.jsonLines.decode(codec.jsonLines.encode(test))
      expect(roundtripped).to.deep.equal([test])
    }
  })
})

describe('models/codec.xml', function () {
  it('encodes random weirdo objects fine', function () {
    const test = { foo: [5, '12', false, null, true], bar: 'no thanks' }
    const expected = [
      '<object xmlns="pigeonmark:arbitrary">',
      '<array name="foo"><number>5</number><string>12</string><false/><null/><true/></array>',
      '<string name="bar">no thanks</string>',
      '</object>'
    ].join('')
    const encoded = codec.xml.encode(test)
    expect(encoded).to.equal(expected)
  })

  it('JsonML decodes xml well', function () {
    const tests = {
      '<root><foo arg="1">msg</foo></root>': ['root', ['foo', { arg: '1' }, 'msg']],
      '<html><foo arg="twenty-three">msg</foo></html>': ['html', ['foo', { arg: 'twenty-three' }, 'msg']],
      '<football>\n  sport\n</football>\n': ['#document', ['football', '\n  sport\n'], '\n']
    }
    for (const [xml, value] of Object.entries(tests)) {
      expect(codec.xml.decode(xml)).to.deep.equal(value)
    }
  })

  it('JsonML roundtrips simple xml well', function () {
    const tests = [
      '<root><foo arg="1">msg</foo></root>',
      '<html><foo arg="twenty-three">msg</foo></html>',
      '<football>sport</football>'
    ]
    for (const xml of tests) {
      const decode = codec.xml.decode(xml)
      const encode = codec.xml.encode(decode)
      expect(encode).to.equal(xml)
    }
  })

  it('can encode a stream', async function () {
    const tests = [
      { foo: 'dingo', bar: 'yeah' },
      { catastrophe: { ooo: 'bingo', argue: 5 } },
      ['root', {}, ['foo', { arg: '1' }, 'msg']]
    ]
    const encoder = Readable.from(tests, { objectMode: true }).pipe(codec.xml.encoder())
    const output = Buffer.concat(await asyncIterableToArray(encoder)).toString('utf-8')
    const expected = [
      '<array>\n',
      '<object xmlns="pigeonmark:arbitrary"><string name="foo">dingo</string><string name="bar">yeah</string></object>\n',
      '<object xmlns="pigeonmark:arbitrary"><object name="catastrophe"><string name="ooo">bingo</string><number name="argue">5</number></object></object>\n',
      '<root><foo arg="1">msg</foo></root>\n',
      '</array>\n'
    ]
    expect(output).to.equal(expected.join(''))
  })

  it('behaves as expected', async function () {
    const tests = {
      '<tag attr="\'&quot;\'"/>': ['tag', { attr: "'\"'" }],
      '<tag attr=\'"&apos;"\'/>': ['tag', { attr: '"\'"' }],
      '<tag>foo</tag>': ['tag', 'foo'],
      '<tag/>': ['tag'],
      '<!--this is a comment-->': ['#comment', 'this ', 'is', ' a comment'],
      '<![CDATA[Hello]]>': ['#cdata-section', 'Hello'],
      'foo bar': ['#document-fragment', 'foo', ' ', 'bar']
    }
    for (const [expected, input] of Object.entries(tests)) {
      expect(codec.xml.encode(input)).to.equal(expected)
    }
  })

  it('handles unicode', () => {
    for (const string of unicodeStrings) {
      expect(codec.xml.decode(codec.xml.encode(string))).to.equal(string)
      expect(codec.xml.encode(codec.xml.decode(`<root>${string}</root>`))).to.equal(`<root>${string}</root>`)
    }
  })
})

describe('models/codec.html', () => {
  const testPage = [
    '<!DOCTYPE html>\n',
    '<html><head><title>Hello World</title></head>',
    '<body><p id="universe">how you doing??</p><!-- comments are preserved --></body>',
    '</html>'
  ].join('')

  it('can decode a simple html page', () => {
    const dec = codec.html.decode(testPage)
    expect(dec).to.deep.equal(['#document',
      { doctype: 'html' },
      ['html',
        ['head', ['title', 'Hello World']],
        ['body', ['p', { id: 'universe' }, 'how you doing??'], ['#comment', ' comments are preserved ']]
      ]
    ])
  })

  it('encodes reasonable structures accurately', () => {
    expect(codec.html.encode(['#comment', ' hello '])).to.equal('<!-- hello -->')
    expect(codec.html.encode(['#document-fragment', ['br'], ['br']])).to.equal('<br><br>')
    expect(codec.html.encode('foo')).to.equal('foo')
    expect(codec.html.encode('&amp;')).to.equal('&amp;amp;')
    expect(codec.html.encode('<tag>')).to.equal('&lt;tag>')
    expect(codec.html.encode({ id: 'bar' })).to.equal(' id=bar')
    expect(codec.html.encode(['#cdata-section', 'testing & stuff'])).to.equal('<![CDATA[testing & stuff]]>')
  })

  it('decodes the core types correctly', () => {
    expect(codec.html.decode('<!-- hello -->')).to.deep.equal(['#comment', ' hello '])
    expect(codec.html.decode('<br><br>')).to.deep.equal(['#document-fragment', ['br'], ['br']])
    expect(codec.html.decode('foo')).to.deep.equal('foo')
    expect(codec.html.decode('&amp;amp;')).to.deep.equal('&amp;')
    expect(codec.html.decode('&lt;tag>')).to.deep.equal('<tag>')
    expect(codec.html.decode('<![CDATA[testing & stuff]]>')).to.deep.equal(['#cdata-section', 'testing & stuff'])
    expect(codec.html.decode('<tag name=yehaw></tag>')).to.deep.equal(['tag', { name: 'yehaw' }])
  })

  it('roundtrips well', () => {
    const dec = codec.html.decode(testPage)
    const enc = codec.html.encode(dec)
    const roundtrip = codec.html.decode(enc)
    expect(dec).to.deep.equal(roundtrip)
  })

  it('handles unicode', () => {
    for (const string of unicodeStrings) {
      expect(codec.html.encode(string)).to.equal(string)
      expect(codec.html.encode(['tag', string])).to.equal(`<tag>${string}</tag>`)
      expect(codec.html.encode(['img', { title: ' ' + string }])).to.equal(`<img title=" ${string}">`)
      expect(codec.html.decode(string)).to.equal(string)
      expect(codec.html.decode(`<tag>${string}</tag>`)).to.deep.equal(['tag', string])
      expect(codec.html.decode(`<img title="${string}">`)).to.deep.equal(['img', { title: string }])
    }
  })
})

describe('models/codec.path', function () {
  it('encodes without a record ID', function () {
    const opts = { source: 'datasets', author: 'person', name: 'name' }
    expect(codec.path.encode(opts)).to.equal('/datasets/person:name')
  })

  it('encodes with an undefined record ID', function () {
    const opts = { source: 'datasets', author: 'person', name: 'name', recordID: undefined }
    expect(codec.path.encode(opts)).to.equal('/datasets/person:name')
  })

  it('it refuses to encode from a made up fake source', function () {
    const opts = { source: 'mooop', author: 'person', name: 'name' }
    expect(() => codec.path.encode(opts)).to.throw()
  })

  it('roundtrips without a recordID well', function () {
    const opts = { source: 'meta', author: 'bob', name: 'things-corp.exe' }
    expect(codec.path.decode(codec.path.encode(opts))).to.deep.equal(opts)
  })

  it('works with recordIDs', function () {
    for (const recordID of ['quilts', 'delete.exe', '🍃', '日本語']) {
      const opts = { source: 'datasets', author: 'freda', name: 'froglegs', recordID }
      const roundtrip = codec.path.decode(codec.path.encode(opts))
      expect(roundtrip).to.deep.equal(opts)
    }
  })

  it('encodes with arglist instead of object', function () {
    const a = codec.path.encode({ source: 'datasets', author: 'bean', name: 'bags', recordID: 'shredded foam' })
    const b = codec.path.encode('datasets', 'bean', 'bags', 'shredded foam')
    expect(a).to.equal(b)
  })
})

describe('models/codec.objectHash', function () {
  it('all the different things hash differently', function () {
    const existing = []
    for (const obj of tests) {
      const hash = codec.objectHash(obj).toString('hex')
      expect(existing).to.not.include(hash)
      existing.push(hash)
    }
  })

  it('insertion order doesn\'t matter', function () {
    const a = codec.objectHash({ a: 1, b: 2 }).toString('hex')
    const b = codec.objectHash({ b: 2, a: 1 }).toString('hex')
    expect(a).to.equal(b)
  })

  it('the same thing hashes the same', function () {
    const v8 = require('v8')
    for (const obj of tests) {
      const copy = v8.deserialize(v8.serialize(obj))
      const a = codec.objectHash(obj).toString('hex')
      const b = codec.objectHash(copy).toString('hex')
      expect(a).to.equal(b, `with object type ${typeDetect(obj)}`)
    }
  })
})

describe('models/codec.for()', () => {
  it('looks up by media types', function () {
    expect(codec.for('application/json')).to.equal(codec.json)
    expect(codec.for('application/cbor')).to.equal(codec.cbor)
    expect(codec.for('application/msgpack')).to.equal(codec.msgpack)
    expect(codec.for('application/yaml')).to.equal(codec.yaml)
    expect(codec.for('application/ndjson')).to.equal(codec.jsonLines)
    expect(codec.for('application/jsonlines')).to.equal(codec.jsonLines)
    expect(codec.for('application/xml')).to.equal(codec.xml)
  })

  it('looks up by path with extension', function () {
    expect(codec.for('/path/to/some-file.json')).to.equal(codec.json)
    expect(codec.for('/path/to/some-file.cbor')).to.equal(codec.cbor)
    expect(codec.for('/path/to/some-file.msgpack')).to.equal(codec.msgpack)
    expect(codec.for('/path/to/some-file.yaml')).to.equal(codec.yaml)
    expect(codec.for('/path/to/some-file.jsonl')).to.equal(codec.jsonLines)
    expect(codec.for('/path/to/some-file.xml')).to.equal(codec.xml)
  })

  it('looks up by extension alone', function () {
    expect(codec.for('json')).to.equal(codec.json)
    expect(codec.for('cbor')).to.equal(codec.cbor)
    expect(codec.for('msgpack')).to.equal(codec.msgpack)
    expect(codec.for('yaml')).to.equal(codec.yaml)
    expect(codec.for('jsonl')).to.equal(codec.jsonLines)
    expect(codec.for('xml')).to.equal(codec.xml)
  })
})
