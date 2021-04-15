const asyncIterableToArray = require('../library/utility/async-iterable-to-array')
const crypto = require('crypto')
const chai = require('chai')
chai.use(require('chai-as-promised'))
const expect = chai.expect
const { Readable } = require('stream')
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

describe('models/file/raw', function () {
  it('raw.read() and raw.write()', async function () {
    for (const test of tests) {
      const path = ['file-tests', randomName()]

      await raw.write(path, test)
      const data = await raw.read(path)
      expect(data).is.a('Uint8Array')
      expect(data.equals(test)).to.equal(true)

      await raw.delete(path)
    }
  })

  it('raw.append()', async function () {
    const path = ['file-tests', randomName()]
    for (const test of tests) await raw.append(path, test)
    expect(Buffer.concat(tests).equals(await raw.read(path))).to.equal(true)
  })

  it('raw.writeStream()', async function () {
    for (const test of tests) {
      const path = ['file-tests', randomName()]
      await raw.writeStream(path, Readable.from(test))
      const data = await raw.read(path)
      expect(data.equals(test)).to.equal(true)
    }
  })

  it('raw.appendStream()', async function () {
    const path = ['file-tests', randomName()]
    await raw.appendStream(path, Readable.from(tests))
    const readback = await raw.read(path)
    expect(readback.equals(Buffer.concat(tests))).to.equal(true)
  })

  it('raw.appendStream() anticlobbering', async function () {
    const path = ['file-tests', randomName()]
    const writes = []
    for (const test of tests) writes.push(raw.appendStream(path, Readable.from(test)))
    await Promise.all(writes)
    const readback = await raw.read(path)
    expect(readback.equals(Buffer.concat(tests))).to.equal(true)
  })

  it('raw.delete() works', async function () {
    const path = ['file-tests', randomName()]
    await raw.write(path, Buffer.from('Green tea is an effective way to reduce histamine activity in the body'))
    await raw.delete(path)
    await expect(raw.read(path)).to.be.rejected
  })

  it('raw.delete() silently does nothing when the specified path already doesn\'t exist', async function () {
    const path = ['file-tests', randomName()]
    await raw.delete(path)
    await raw.delete(path)
    await expect(raw.read(path)).to.be.rejected
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
    expect(buf.readUInt16LE(0)).to.equal(100)
  })

  it('raw.rename() works', async function () {
    const path1 = ['file-tests', randomName()]
    const path2 = ['file-tests', randomName()]
    const testData = crypto.randomBytes(64)
    await raw.write(path1, testData)
    await expect(raw.read(path1)).to.eventually.deep.equal(testData)
    await raw.rename(path1, path2)
    await expect(raw.read(path2)).to.eventually.deep.equal(testData)
    await expect(raw.exists(path1)).to.become(false)
    await expect(raw.exists(path2)).to.become(true)
    await raw.delete(path2)
  })

  it('raw.exists() works', async function () {
    const path = ['file-tests', randomName()]
    await raw.write(path, Buffer.from('hello friend'))
    await expect(raw.exists(path)).to.become(true)
    await expect(raw.exists(['file-tests', randomName()])).to.become(false)
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
    expect(output.sort()).to.deep.equal(files.sort())

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
    expect(output.sort()).to.deep.equal(folders.sort())

    await raw.delete(['file-tests'])
  })

  after(async function () {
    await raw.delete(['file-tests'])
  })
})
