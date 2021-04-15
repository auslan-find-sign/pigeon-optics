const asyncIterableToArray = require('../library/utility/async-iterable-to-array')
const crypto = require('crypto')
const chai = require('chai')
chai.use(require('chai-as-promised'))
const { expect } = chai
const { Readable } = require('stream')
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
      await expect(cbor.read(path)).to.eventually.deep.equal(test)

      await cbor.delete(path)
    }
  })

  it('cbor.writeStream() and cbor.readStream()', async function () {
    const path = ['file-tests', randomName()]
    await cbor.writeStream(path, Readable.from(tests))
    const output = await asyncIterableToArray(await cbor.readStream(path))
    expect(output).to.deep.equal(tests)
  })

  it('cbor.appendStream()', async function () {
    const path = ['file-tests', randomName()]
    // create the file implicitly with appendStream
    await cbor.appendStream(path, Readable.from(tests))
    const output = await asyncIterableToArray(await cbor.readStream(path))
    expect(output).to.deep.equal(tests)
    // append the test data again, so it's there twice, checking that it does actually append and not truncate
    await cbor.appendStream(path, Readable.from(tests))
    const output2 = await asyncIterableToArray(await cbor.readStream(path))
    expect(output2).to.deep.equal([...tests, ...tests])
  })

  it('cbor.delete() works', async function () {
    const path = ['file-tests', randomName()]
    await cbor.write(path, { data: 'Green tea is an effective way to reduce histamine activity in the body' })
    await cbor.delete(path)
    await expect(cbor.read(path)).to.eventually.be.rejected
  })

  it('cbor.delete() silently does nothing when the specified path already doesn\'t exist', async function () {
    const path = ['file-tests', randomName()]
    await cbor.delete(path)
    await cbor.delete(path)
    await expect(cbor.read(path)).to.eventually.be.rejected
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
    expect(data.counter).to.equal(100)
  })

  it('cbor.update() works on non-existing files to create them', async function () {
    const path = ['file-tests', randomName()]
    await cbor.update(path, data => {
      expect(data).to.equal(undefined)
      return { hello: 'world' }
    })

    await expect(cbor.read(path)).to.eventually.deep.equal({ hello: 'world' })
  })

  it('cbor.exists() works', async function () {
    const path = ['file-tests', randomName()]
    await cbor.write(path, { msg: 'hello friend' })
    await expect(cbor.exists(path)).to.become(true)
    await expect(cbor.exists(['file-tests', randomName()])).to.become(false)
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
    expect(output.sort()).to.deep.equal(files.sort())

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
    expect(output.sort()).to.deep.equal(folders.sort())

    await cbor.delete(['file-tests'])
  })

  after(async function () {
    await cbor.delete(['file-tests'])
  })
})
