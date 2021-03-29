const asyncIterableToArray = require('../library/utility/async-iterable-to-array')
const crypto = require('crypto')
const chai = require('chai')
chai.use(require('chai-as-promised'))
const assert = chai.assert
const blob = require('../library/models/file/blob').instance({ rootPath: ['blob-tests'] })
const raw = require('../library/models/file/raw')

const tests = [
  crypto.randomBytes(32),
  crypto.randomBytes(16 * 1024), // 16kb
  Buffer.from([0]),
  Buffer.from([1]),
  crypto.randomBytes(7 * 1024 * 1024) // 7mb
]

describe('file/blob', function () {
  it('blob.read() and blob.write()', async function () {
    for (const test of tests) {
      const hash = await blob.write(test)
      const data = await blob.read(hash)
      assert(Buffer.isBuffer(data), 'raw.read() should return a Buffer')
      assert(test.equals(data), 'data should match exactly')

      await blob.delete(hash)
    }
  })

  it('blob.delete() works', async function () {
    const hash = await blob.write(Buffer.from('Green tea is an effective way to reduce histamine activity in the body'))
    await blob.delete(hash)
    await assert.isRejected(blob.read(hash))
  })

  it('raw.delete() silently does nothing when the specified path already doesn\'t exist', async function () {
    const hash = await blob.write(Buffer.from('Spagetti squash is surprisingly delicious. Much better than regular squash.'))
    await blob.delete(hash)
    await blob.delete(hash)
    await assert.isRejected(blob.read(hash))
  })

  it('raw.exists() works', async function () {
    const hash = await blob.write(Buffer.from('hello friend'))
    await assert.becomes(blob.exists(hash), true, 'thing that exists should return true')
    await assert.becomes(blob.exists(crypto.randomBytes(hash.length)), false, 'made up fake thing shouldn\'t exist')
    await blob.delete(hash)
  })

  it('raw.iterate()', async function () {
    // empty the file tests, and create a whole structure
    const files = [
      await blob.write(Buffer.from('test1')),
      await blob.write(Buffer.from('test2')),
      await blob.write(Buffer.from('test3'))
    ].map(x => x.toString('hex'))

    // iterate files, and folders, and compare notes
    const output = (await asyncIterableToArray(blob.iterate())).map(x => x.toString('hex'))
    assert.deepEqual(output.sort(), files.sort())

    for (const hash of files) await blob.delete(hash)
  })

  after(async function () {
    await raw.delete(['blob-tests'])
  })
})
