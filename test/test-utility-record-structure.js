const recStruc = require('../library/utility/record-structure')
const assert = require('assert')
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

describe('utility/record-structure.resolveFileURLs', function () {
  it('converts the document', function () {
    const attachedFilesByName = {
      'foo.txt': { path: '/tmp/foo-123.txt', hash: crypto.randomBytes(32), type: 'text/plain' },
      'bar.bin': { path: '/tmp/bar-xyz.bin', hash: crypto.randomBytes(32), type: 'application/octet-stream' }
    }

    const input = {
      hey: 'file:///foo.txt',
      cool: ['yes', 'file:///bar.bin', 'no'],
      'file:///foo.txt': 6
    }
    const expected = {
      hey: makehash(attachedFilesByName['foo.txt'].hash, attachedFilesByName['foo.txt'].type),
      cool: ['yes', makehash(attachedFilesByName['bar.bin'].hash, attachedFilesByName['bar.bin'].type), 'no'],
      [makehash(attachedFilesByName['foo.txt'].hash, attachedFilesByName['foo.txt'].type)]: 6
    }
    const output = recStruc.resolveFileURLs(input, attachedFilesByName)
    assert.deepStrictEqual(output, expected, 'should swap all the file:/// URLs for hash:// URLs')
  })
})
