/* eslint-env mocha */
const prb = require('../library/utility/parse-request-body')
const codec = require('../library/models/codec')
const { expect } = require('chai')
const { Readable } = require('stream')
const asyncIterableToArray = require('../library/utility/async-iterable-to-array')

// very basic mock express Request object
function reqMock (contentType, data) {
  if (!Buffer.isBuffer(data)) data = Buffer.from(data)
  const stream = Readable.from([data])
  stream.get = name => name.toLowerCase() === 'content-type' ? contentType : undefined
  return stream
}

const testDatas = [
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
  },
  ['element', { name: 'foo' }, 'text node', ['subel', { name: 'bar' }], 'after text node'],
  [
    { a: 1, b: 2, c: { a: 'wep', b: false, g: { bar: 'recursive hell', f: [1, 2, [{ u: false, j: true }, 3, 4, 5]] } } },
    [1, 2, 3, 4, 5, [1, 2, 3, 4, [9, 8, 7, 6], [2, 5, 6, 8, { a: true, b: false }]]]
  ]
]

describe('utility/parse-request-body.one', () => {
  const types = ['json', 'cbor', 'yaml', 'xml', 'msgpack']
  for (const type of types) {
    it(`parses ${type}`, async () => {
      for (const testData of testDatas) {
        const enc = codec[type].encode(testData)
        const req = reqMock(codec[type].handles[0], enc)
        const out = await prb.one(req)
        expect(out).to.deep.equal(testData)
      }
    })
  }
})

describe('utility/parse-request-body.iterate', () => {
  const types = ['json', 'cbor', 'yaml', 'msgpack', 'jsonLines']
  for (const type of types) {
    it(`streams out ${type} correctly`, async () => {
      const objStream = Readable.from(testDatas, { objectMode: true })
      const encStream = objStream.pipe(await codec[type].encoder())
      const enc = Buffer.concat(await asyncIterableToArray(encStream))
      const req = reqMock(codec[type].handles[0], enc)

      const dec = await asyncIterableToArray(prb.iterate(req))
      expect(dec).to.deep.equal(testDatas)
    })
  }
})
