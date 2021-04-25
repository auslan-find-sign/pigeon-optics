const recStruc = require('../library/utility/record-structure')
const { expect } = require('chai')
const crypto = require('crypto')

function makehash (hash, type) {
  return `hash://sha256/${hash.toString('hex')}?type=${encodeURIComponent(`${type}`)}`
}

function fakehash (list) {
  const hash = crypto.randomBytes(32)
  const type = 'text/plain'
  const string = makehash(hash, type)
  if (list) list.push(string)
  return string
}

describe('utility/record-structure.listHashURLs', function () {
  it('finds hashes in arrays', function () {
    const expected = []
    const input = ['foo', 5, Symbol('yeahnah'), fakehash(expected), -6000, fakehash(expected)]
    const result = recStruc.listHashURLs(input).map(x => `${x}`)
    expect(result).to.deep.equal(expected)
  })

  it('finds hashes in object values', function () {
    const expected = []
    const input = { foo: 'bar', yes: fakehash(expected) }
    const result = recStruc.listHashURLs(input).map(x => `${x}`)
    expect(result).to.deep.equal(expected)
  })

  it('finds hashes in object keys', function () {
    const expected = []
    const input = { foo: 'bar', [fakehash(expected)]: 15 }
    const result = recStruc.listHashURLs(input).map(x => `${x}`)
    expect(result).to.deep.equal(expected)
  })

  it('finds hashes in sets', function () {
    const expected = []
    const input = new Set(['foo', 'bar', fakehash(expected), 15])
    const result = recStruc.listHashURLs(input).map(x => `${x}`)
    expect(result).to.deep.equal(expected)
  })

  it('finds hashes in map values', function () {
    const expected = []
    const input = new Map([['foo', 'bar'], ['yeah please', fakehash(expected)]])
    const result = recStruc.listHashURLs(input).map(x => `${x}`)
    expect(result).to.deep.equal(expected)
  })

  it('finds hashes in map keys', function () {
    const expected = []
    const input = new Map([['foo', 'bar'], [fakehash(expected), 'alright then']])
    const result = recStruc.listHashURLs(input).map(x => `${x}`)
    expect(result).to.deep.equal(expected)
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

    const result = recStruc.listHashURLs(input).map(x => `${x}`)
    expect(result).to.deep.equal(expected)
  })
})

describe('utility/record-structure.resolveContentIDs', function () {
  it('converts the document', function () {
    const files = {
      'foo.txt': { hash: crypto.randomBytes(32), type: 'text/plain' },
      'bar.bin': { hash: crypto.randomBytes(32), type: 'application/octet-stream' }
    }
    const hash = Object.fromEntries(Object.entries(files).map(([k, v]) => [k, makehash(v.hash, v.type)]))

    const input = {
      hey: 'cid:foo.txt',
      cool: ['yes', 'cid:bar.bin', 'no'],
      'cid:foo.txt': 6
    }
    const expected = {
      hey: hash['foo.txt'],
      cool: ['yes', hash['bar.bin'], 'no'],
      [hash['foo.txt']]: 6
    }
    const output = recStruc.resolveContentIDs(input, files)
    expect(output).to.deep.equal(expected)
  })
})
