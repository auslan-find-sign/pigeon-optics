const asyncIterableToArray = require('../library/utility/async-iterable-to-array')
const crypto = require('crypto')
const chai = require('chai')
chai.use(require('chai-as-promised'))
const { Readable } = require('stream')
const assert = chai.assert
const raw = require('../library/models/file/raw')

const tests = [
  crypto.randomBytes(32),
  crypto.randomBytes(16 * 1024), // 16kb
  Buffer.from([0]),
  Buffer.from([1]),
  crypto.randomBytes(7 * 1024 * 1024) // 7mb
]

function randomName () {
  return crypto.randomBytes(32).toString('hex')
}

describe('file/raw', function () {
  it('raw.read() and raw.write()', async function () {
    for (const test of tests) {
      const path = ['file-tests', randomName()]

      await raw.write(path, test)
      const data = await raw.read(path)
      assert(Buffer.isBuffer(data), 'raw.read() should return a Buffer')
      assert(test.equals(data), 'data should match exactly')

      await raw.delete(path)
    }
  })

  it('raw.writeStream()', async function () {
    for (const test of tests) {
      const path = ['file-tests', randomName()]
      await raw.writeStream(path, Readable.from(test))
      const read = await raw.read(path)
      assert(read.equals(test))
    }
  })

  it('raw.delete() works', async function () {
    const path = ['file-tests', randomName()]
    await raw.write(path, Buffer.from('Green tea is an effective way to reduce histamine activity in the body'))
    await raw.delete(path)
    await assert.isRejected(raw.read(path))
  })

  it('raw.delete() silently does nothing when the specified path already doesn\'t exist', async function () {
    const path = ['file-tests', randomName()]
    await raw.delete(path)
    await raw.delete(path)
    await assert.isRejected(raw.read(path))
  })

  it('raw.update() concurrent requests queue and don\'t clobber', async function () {
    const path = ['file-tests', randomName()]
    await raw.write(path, Buffer.from([0, 0]))
    await Promise.all((new Array(100)).fill(true).map(async () => {
      await raw.update(path, buf => {
        buf.writeUInt16LE(buf.readUInt16LE(0) + 1, 0)
        return buf
      })
    }))

    const buf = await raw.read(path)
    assert.strictEqual(buf.readUInt16LE(0), 100, 'number should be exactly 100')
  })

  it('raw.exists() works', async function () {
    const path = ['file-tests', randomName()]
    await raw.write(path, Buffer.from('hello friend'))
    await assert.becomes(raw.exists(path), true, 'thing that exists should return true')
    await assert.becomes(raw.exists(['file-tests', randomName()]), false, 'made up fake thing shouldn\'t exist')
    await raw.delete(path)
  })

  it('raw.iterate()', async function () {
    const files = ['foo', 'bar', 'yes', '💾', 'no']
    const folders = ['groupA', 'groupB', '🍃']

    // empty the file tests, and create a whole structure
    await raw.delete(['file-tests'])
    for (const file of files) await raw.write(['file-tests', file], Buffer.from('test'))
    for (const folder of folders) await raw.write(['file-tests', folder, 'inside'], Buffer.from('test'))

    // iterate files, and folders, and compare notes
    const output = await asyncIterableToArray(raw.iterate(['file-tests']))
    assert.deepEqual(output.sort(), files.sort())

    await raw.delete(['file-tests'])
  })

  it('raw.iterateFolders()', async function () {
    const files = ['foo', 'bar', 'yes', '💾', 'no']
    const folders = ['groupA', 'groupB', '🍃']

    // empty the file tests, and create a whole structure
    await raw.delete(['file-tests'])
    for (const file of files) await raw.write(['file-tests', file], Buffer.from('test'))
    for (const folder of folders) await raw.write(['file-tests', folder, 'inside'], Buffer.from('test'))

    // iterate files, and folders, and compare notes
    const output = await asyncIterableToArray(raw.iterateFolders(['file-tests']))
    assert.deepEqual(output.sort(), folders.sort())

    await raw.delete(['file-tests'])
  })

  after(async function () {
    await raw.delete(['file-tests'])
  })
})
