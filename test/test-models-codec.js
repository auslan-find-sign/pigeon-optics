const codec = require('../library/models/codec')
const assert = require('assert')

const tests = [
  true,
  false,
  null,
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
      assert.deepStrictEqual(roundtripped, obj, 'roundtripped version should match deeply')
    })

    it('decodes json5 pretty printed version correctly', function () {
      const roundtripped = codec.json.decode(codec.json.print(obj))
      assert.deepStrictEqual(roundtripped, obj, 'roundtripped version should match deeply')
    })
  }
})

describe('models/codec.cbor', function () {
  for (const obj of tests) {
    it(`encodes type ${typeof obj} reversably`, function () {
      const roundtripped = codec.cbor.decode(codec.cbor.encode(obj))
      assert.deepStrictEqual(roundtripped, obj, 'roundtripped version should match deeply')
    })
  }
})

describe('models/codec.path', function () {
  it('encodes without a record ID', function () {
    const opts = { source: 'datasets', user: 'user', name: 'name' }
    assert.strictEqual(codec.path.encode(opts), '/datasets/user:name')
  })

  it('encodes with an undefined record ID', function () {
    const opts = { source: 'datasets', user: 'user', name: 'name', recordID: undefined }
    assert.strictEqual(codec.path.encode(opts), '/datasets/user:name')
  })

  it('it refuses to encode from a made up fake source', function () {
    const opts = { source: 'mooop', user: 'user', name: 'name' }
    assert.throws(() => codec.path.encode(opts))
  })

  it('roundtrips without a recordID well', function () {
    const opts = { source: 'meta', user: 'bob', name: 'things-corp.exe' }
    assert.deepStrictEqual({ ...codec.path.decode(codec.path.encode(opts)) }, opts)
  })

  it('works with recordIDs', function () {
    for (const recordID of ['quilts', 'delete.exe', '🍃', '日本語']) {
      const opts = { source: 'datasets', user: 'freda', name: 'froglegs', recordID }
      const roundtrip = codec.path.decode(codec.path.encode(opts))
      assert.strictEqual(roundtrip.recordID, recordID)
    }
  })

  it('encodes with arglist instead of object', function () {
    const a = codec.path.encode({ source: 'datasets', user: 'bean', name: 'bags', recordID: 'shredded foam' })
    const b = codec.path.encode('datasets', 'bean', 'bags', 'shredded foam')
    assert.strictEqual(a, b, 'they should match')
  })
})

describe('models/codec.objectHash', function () {
  it('all the different things hash differently', function () {
    const existing = []
    for (const obj of tests) {
      const hash = codec.objectHash(obj).toString('hex')
      assert(!existing.includes(hash))
      existing.push(hash)
    }
  })

  it('insertion order doesn\'t matter', function () {
    const a = codec.objectHash({ a: 1, b: 2 }).toString('hex')
    const b = codec.objectHash({ b: 2, a: 1 }).toString('hex')
    assert.strictEqual(a, b, 'hashes should be equal')
  })

  it('the same thing hashes the same', function () {
    for (const obj of tests) {
      const copy = codec.cbor.decode(codec.cbor.encode(obj))
      const a = codec.objectHash(obj).toString('hex')
      const b = codec.objectHash(copy).toString('hex')
      assert.strictEqual(a, b, 'hash of copy should match hash of original')
    }
  })
})
