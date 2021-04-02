const asyncIterableToArray = require('../library/utility/async-iterable-to-array')
const crypto = require('crypto')
const chai = require('chai')
chai.use(require('chai-as-promised'))
const assert = chai.assert
const cbor = require('../library/models/file/cbor')

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

function randomName () {
  return crypto.randomBytes(32).toString('hex')
}

describe('models/file/cbor', function () {
  it('cbor.read() and cbor.write()', async function () {
    for (const test of tests) {
      const path = ['file-tests', randomName()]

      await cbor.write(path, test)
      const data = await cbor.read(path)
      assert.deepEqual(data, test, 'data should match exactly')

      await cbor.delete(path)
    }
  })

  it('cbor.delete() works', async function () {
    const path = ['file-tests', randomName()]
    await cbor.write(path, { data: 'Green tea is an effective way to reduce histamine activity in the body' })
    await cbor.delete(path)
    await assert.isRejected(cbor.read(path))
  })

  it('cbor.delete() silently does nothing when the specified path already doesn\'t exist', async function () {
    const path = ['file-tests', randomName()]
    await cbor.delete(path)
    await cbor.delete(path)
    await assert.isRejected(cbor.read(path))
  })

  it('cbor.update() concurrent requests queue and don\'t clobber', async function () {
    const path = ['file-tests', randomName()]
    await cbor.write(path, { counter: 0 })
    await Promise.all((new Array(100)).fill(true).map(async () => {
      await cbor.update(path, data => {
        return { counter: data.counter + 1 }
      })
    }))

    const data = await cbor.read(path)
    assert.strictEqual(data.counter, 100, 'number should be exactly 100')
  })

  it('cbor.exists() works', async function () {
    const path = ['file-tests', randomName()]
    await cbor.write(path, { msg: 'hello friend' })
    await assert.becomes(cbor.exists(path), true, 'thing that exists should return true')
    await assert.becomes(cbor.exists(['file-tests', randomName()]), false, 'made up fake thing shouldn\'t exist')
    await cbor.delete(path)
  })

  it('cbor.iterate()', async function () {
    const files = ['foo', 'bar', 'yes', '💾', 'no']
    const folders = ['groupA', 'groupB', '🍃']

    // empty the file tests, and create a whole structure
    await cbor.delete(['file-tests'])
    for (const file of files) await cbor.write(['file-tests', file], { test: true })
    for (const folder of folders) await cbor.write(['file-tests', folder, 'inside'], { test: true })

    // iterate files, and folders, and compare notes
    const output = await asyncIterableToArray(cbor.iterate(['file-tests']))
    assert.deepEqual(output.sort(), files.sort())

    await cbor.delete(['file-tests'])
  })

  it('cbor.iterateFolders()', async function () {
    const files = ['foo', 'bar', 'yes', '💾', 'no']
    const folders = ['groupA', 'groupB', '🍃']

    // empty the file tests, and create a whole structure
    await cbor.delete(['file-tests'])
    for (const file of files) await cbor.write(['file-tests', file], { test: true })
    for (const folder of folders) await cbor.write(['file-tests', folder, 'inside'], { test: true })

    // iterate files, and folders, and compare notes
    const output = await asyncIterableToArray(cbor.iterateFolders(['file-tests']))
    assert.deepEqual(output.sort(), folders.sort())

    await cbor.delete(['file-tests'])
  })

  after(async function () {
    await cbor.delete(['file-tests'])
  })
})
