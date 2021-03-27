const recStruc = require('../library/utility/record-structure')
const assert = require('assert')
const crypto = require('crypto')

function fakehash (list) {
  const hash = crypto.randomBytes(32).toString('hex')
  const type = 'text/plain'
  const string = `hash://sha256/${hash}?type=${encodeURIComponent(type)}`
  if (list) list.push(string)
  return string
}

describe('record-structure.listHashURLs', function () {
  it('finds hashes in arrays', function () {
    const expected = []
    const input = ['foo', 5, Symbol('yeahnah'), fakehash(expected), -6000, fakehash(expected)]
    const result = recStruc.listHashURLs(input).map(x => `${x}`)
    assert.deepStrictEqual(result.sort(), expected.sort(), 'should find both fake hashes')
  })

  it('finds hashes in object values', function () {
    const expected = []
    const input = { foo: 'bar', yes: fakehash(expected) }
    const result = recStruc.listHashURLs(input).map(x => `${x}`)
    assert.deepStrictEqual(result.sort(), expected.sort(), 'should find the hash')
  })

  it('finds hashes in object keys', function () {
    const expected = []
    const input = { foo: 'bar', [fakehash(expected)]: 15 }
    const result = recStruc.listHashURLs(input).map(x => `${x}`)
    assert.deepStrictEqual(result.sort(), expected.sort(), 'should find the hash')
  })

  it('finds hashes in sets', function () {
    const expected = []
    const input = new Set(['foo', 'bar', fakehash(expected), 15])
    const result = recStruc.listHashURLs(input).map(x => `${x}`)
    assert.deepStrictEqual(result.sort(), expected.sort(), 'should find the hash')
  })

  it('finds hashes in map values', function () {
    const expected = []
    const input = new Map([['foo', 'bar'], ['yeah please', fakehash(expected)]])
    const result = recStruc.listHashURLs(input).map(x => `${x}`)
    assert.deepStrictEqual(result.sort(), expected.sort(), 'should find the hash')
  })

  it('finds hashes in map keys', function () {
    const expected = []
    const input = new Map([['foo', 'bar'], [fakehash(expected), 'alright then']])
    const result = recStruc.listHashURLs(input).map(x => `${x}`)
    assert.deepStrictEqual(result.sort(), expected.sort(), 'should find the hash')
  })

  it('builds a correct list', function () {
    const expected = []
    const input = {
      foo: [
        'went',
        ['to', 'the', 'store', 'at', fakehash(expected)],
        'and',
        {
          then: {
            caught: {
              [fakehash(expected)]: 'a bean',
              and: fakehash(expected)
            }
          },
          with: new Set([fakehash(expected), fakehash(expected)]),
          andAlso: new Map([['key', fakehash(expected)], [fakehash(expected), 'value']])
        }
      ]
    }

    const output = recStruc.listHashURLs(input).map(x => `${x}`)
    assert.deepStrictEqual(output.sort(), expected.sort(), 'should recover all the hash urls')
  })
})

describe('record-structure.cidToHash', function () {
  it('converts the document', function () {
    const fh1 = fakehash()
    const fh2 = fakehash()
    const cidMap = { foo: fh1, bar: fh2 }

    const input = {
      hey: 'cid:foo',
      cool: ['yes', 'CID:bar', 'no'],
      'cid:foo': 6
    }
    const expected = {
      hey: fh1,
      cool: ['yes', fh2, 'no'],
      [fh1]: 6
    }
    const output = recStruc.cidToHash(input, cidMap)
    assert.deepStrictEqual(output, expected, 'should swap all the cids for hash urls')
  })
})
