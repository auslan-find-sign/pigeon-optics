const codec = require('../library/models/codec')
const { expect } = require('chai')
const { Readable } = require('stream')
const asyncIterableToArray = require('../library/utility/async-iterable-to-array')

const tests = [
  true,
  false,
  5,
  9274,
  0.0001,
  [1, 2, 3],
  [null, null, null],
  Buffer.from('hello world'),
  { a: 1, b: 2 },
  { 1: false, 2: true },
  {
    foo: [1, 2, 3, null, 5],
    bar: {
      1: 'yes',
      2: 'no',
      g: 'maybe'
    },
    bools: [true, false],
    buffery: Buffer.from('hello world')
  }
]

describe('models/codec.json', function () {
  for (const obj of tests) {
    it(`encodes type ${typeof obj} reversably`, function () {
      const roundtripped = codec.json.decode(codec.json.encode(obj))
      expect(roundtripped).to.deep.equal(obj)
    })

    it('decodes json5 pretty printed version correctly', function () {
      const roundtripped = codec.json.decode(codec.json.print(obj))
      expect(roundtripped).to.deep.equal(obj)
    })
  }
})

describe('models/codec.cbor', function () {
  for (const obj of tests) {
    it(`encodes type ${typeof obj} reversably`, function () {
      const roundtripped = codec.cbor.decode(codec.cbor.encode(obj))
      expect(roundtripped).to.deep.equal(obj)
    })
  }
})

describe('models/codec.yaml', function () {
  for (const obj of tests) {
    it(`encodes type ${typeof obj} reversably`, function () {
      const roundtripped = codec.yaml.decode(codec.yaml.encode(obj))
      expect(roundtripped).to.deep.equal(obj)
    })
  }
})

describe('models/codec.msgpack', function () {
  for (const obj of tests) {
    it(`encodes type ${typeof obj} reversably`, function () {
      const roundtripped = codec.msgpack.decode(codec.msgpack.encode(obj))
      expect(roundtripped).to.deep.equal(obj)
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
      '<object xmlns="pigeon-optics:arbitrary">',
      '<array name="foo"><number>5</number><string>12</string><false/><null/><true/></array>',
      '<string name="bar">no thanks</string>',
      '</object>'
    ].join('')
    const encoded = codec.xml.encode(test)
    expect(encoded).to.equal(expected)
  })

  for (const obj of tests) {
    it(`encodes type ${typeof obj} reversably`, function () {
      const encoded = codec.xml.encode(obj)
      console.log(obj, 'became', encoded)
      const roundtripped = codec.xml.decode(encoded)
      console.log('decoded to', roundtripped)
      expect(roundtripped).to.deep.equal(obj)
    })
  }

  it('JsonML decodes xml well', function () {
    const tests = {
      '<root><foo arg="1">msg</foo></root>': ['root', {}, ['foo', { arg: '1' }, 'msg']],
      '<html><foo arg="twenty-three">msg</foo></html>': ['html', {}, ['foo', { arg: 'twenty-three' }, 'msg']],
      '<football>\n  sport\n</football>\n': ['football', {}, '\n  sport\n']
    }
    for (const [xml, value] of Object.entries(tests)) {
      expect(codec.xml.decode(xml)).to.deep.equal({ JsonML: value })
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
      { JsonML: ['root', {}, ['foo', { arg: '1' }, 'msg']] }
    ]
    const encoder = Readable.from(tests, { objectMode: true }).pipe(codec.xml.encoder())
    const output = Buffer.concat(await asyncIterableToArray(encoder)).toString('utf-8')
    const expected = [
      '<array>\n',
      '<object xmlns="pigeon-optics:arbitrary"><string name="foo">dingo</string><string name="bar">yeah</string></object>\n',
      '<object xmlns="pigeon-optics:arbitrary"><object name="catastrophe"><string name="ooo">bingo</string><number name="argue">5</number></object></object>\n',
      '<root><foo arg="1">msg</foo></root>\n',
      '</array>\n'
    ]
    expect(output).to.equal(expected.join(''))
  })
})

describe('models/codec streaming mode', function () {
  // json doesn't have a decoder currently, special case
  it('codec.json.encoder() works', async function () {
    const input = Readable.from(tests, { objectMode: true })
    const encoder = input.pipe(codec.json.encoder())
    const output = Buffer.concat(await asyncIterableToArray(encoder)).toString('utf-8')
    expect(codec.json.decode(output)).to.deep.equal(tests)
  })

  // check all the other's roundtrip the requests well
  for (const encoder of [codec.jsonLines, codec.yaml, codec.cbor, codec.msgpack]) {
    it(`codec.${Object.entries(codec).find(x => x[1] === encoder)[0]}.encoder() and .decoder() transform streams roundtrip data well`, async function () {
      const encodeStream = encoder.encoder()
      const decodeStream = encoder.decoder()
      const input = Readable.from(tests, { objectMode: true })
      const output = await asyncIterableToArray(input.pipe(encodeStream).pipe(decodeStream))
      expect(output).to.deep.equal(tests)
    })
  }
})

describe('models/codec.path', function () {
  it('encodes without a record ID', function () {
    const opts = { source: 'datasets', user: 'user', name: 'name' }
    expect(codec.path.encode(opts)).to.equal('/datasets/user:name')
  })

  it('encodes with an undefined record ID', function () {
    const opts = { source: 'datasets', user: 'user', name: 'name', recordID: undefined }
    expect(codec.path.encode(opts)).to.equal('/datasets/user:name')
  })

  it('it refuses to encode from a made up fake source', function () {
    const opts = { source: 'mooop', user: 'user', name: 'name' }
    expect(() => codec.path.encode(opts)).to.throw()
  })

  it('roundtrips without a recordID well', function () {
    const opts = { source: 'meta', user: 'bob', name: 'things-corp.exe' }
    expect(codec.path.decode(codec.path.encode(opts))).to.deep.equal(opts)
  })

  it('works with recordIDs', function () {
    for (const recordID of ['quilts', 'delete.exe', '🍃', '日本語']) {
      const opts = { source: 'datasets', user: 'freda', name: 'froglegs', recordID }
      const roundtrip = codec.path.decode(codec.path.encode(opts))
      expect(roundtrip).to.deep.equal(opts)
    }
  })

  it('encodes with arglist instead of object', function () {
    const a = codec.path.encode({ source: 'datasets', user: 'bean', name: 'bags', recordID: 'shredded foam' })
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
    for (const obj of tests) {
      const copy = codec.cbor.decode(codec.cbor.encode(obj))
      const a = codec.objectHash(obj).toString('hex')
      const b = codec.objectHash(copy).toString('hex')
      expect(a).to.equal(b)
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

  it('looks up by extension', function () {
    expect(codec.for('/path/to/some-file.json')).to.equal(codec.json)
    expect(codec.for('/path/to/some-file.cbor')).to.equal(codec.cbor)
    expect(codec.for('/path/to/some-file.msgpack')).to.equal(codec.msgpack)
    expect(codec.for('/path/to/some-file.yaml')).to.equal(codec.yaml)
    expect(codec.for('/path/to/some-file.jsonl')).to.equal(codec.jsonLines)
    expect(codec.for('/path/to/some-file.xml')).to.equal(codec.xml)
  })
})
