/* eslint-env mocha */
/* eslint-disable no-unused-expressions */
const asyncIterableToArray = require('../library/utility/async-iterable-to-array')
const crypto = require('crypto')
const chai = require('chai')
chai.use(require('chai-as-promised'))
const expect = chai.expect
const compressed = require('../library/models/fs/compressed')
const delay = require('delay')
const fs = require('fs-extra')

const tests = [
  crypto.randomBytes(32),
  crypto.randomBytes(16 * 1024), // 16kb
  Buffer.from([0]),
  Buffer.from([1]),
  crypto.randomBytes(3 * 1024 * 1024) // 3mb
]

function randomName (prefix) {
  return (prefix ? `${prefix}-` : '') + crypto.randomBytes(8).toString('hex')
}

describe('models/fs/compressed', function () {
  this.timeout(500)
  this.slow(250)

  const testFolder = randomName('fs-compressed-tests')

  beforeEach(async () => {
    await fs.remove(compressed.resolveSystemPath([testFolder], ''))
  })

  afterEach(async () => {
    await fs.remove(compressed.resolveSystemPath([testFolder], ''))
  })

  it('compressed.read(path) and compressed.write(path, buffer)', async function () {
    for (const test of tests) {
      const path = [testFolder, randomName()]

      await compressed.write(path, test)
      const data = await compressed.read(path)
      expect(data).is.a('Uint8Array')
      expect(data.equals(test)).to.equal(true)
    }
  })

  it('compressed.append(path, buffer)', async function () {
    const path = [testFolder, randomName()]
    for (const test of tests) await compressed.append(path, test)
    expect(Buffer.concat(tests).equals(await compressed.read(path))).to.equal(true)
  })

  it('compressed.writeIter(path, iterable)', async function () {
    for (const test of tests) {
      const path = [testFolder, randomName()]
      await compressed.writeIter(path, [test])
      const data = await compressed.read(path)
      expect(data.equals(test)).to.equal(true)
    }
  })

  it('compressed.appendIter(path, iterable)', async function () {
    const path = [testFolder, randomName()]
    await compressed.appendIter(path, tests)
    const readback = await compressed.read(path)
    expect(readback.equals(Buffer.concat(tests))).to.equal(true)
  })

  it('compressed.readIter(path)', async function () {
    const path = [testFolder, randomName()]
    await compressed.write(path, Buffer.from('foobar'))
    const chunks = await asyncIterableToArray(compressed.readIter(path))
    expect(Buffer.concat(chunks).toString('utf-8')).to.equal('foobar')
  })

  it('compressed.readIter(fakePath) errors well', async function () {
    const path = [testFolder, randomName('fake-path')]
    await expect(asyncIterableToArray(compressed.readIter(path))).to.be.rejectedWith('ENOENT')
  })

  it('compressed.delete(path) works', async function () {
    const path = [testFolder, randomName()]
    await compressed.write(path, Buffer.from('Green tea is an effective way to reduce histamine activity in the body'))
    await compressed.delete(path)
    await expect(compressed.read(path)).to.be.rejected
  })

  it('compressed.delete(path) silently does nothing when the specified path already doesn\'t exist', async function () {
    const path = [testFolder, randomName()]
    await compressed.delete(path)
    await compressed.delete(path)
    await expect(compressed.read(path)).to.be.rejected
  })

  it('compressed.update(path, cb(buffer)) concurrent requests queue and don\'t clobber', async function () {
    const path = [testFolder, randomName()]
    await compressed.write(path, Buffer.from([0, 0]))
    await Promise.all((new Array(100)).fill(true).map(async () => {
      await compressed.update(path, buf => {
        buf.writeUInt16LE(buf.readUInt16LE(0) + 1, 0)
        return buf
      })
    }))

    const buf = await compressed.read(path)
    expect(buf.readUInt16LE(0)).to.equal(100)
  })

  it('compressed.rename(path1, path2) works', async function () {
    const path1 = [testFolder, randomName()]
    const path2 = [testFolder, randomName()]
    const testData = crypto.randomBytes(64)
    await compressed.write(path1, testData)
    await expect(compressed.read(path1)).to.eventually.deep.equal(testData)
    await compressed.rename(path1, path2)
    await expect(compressed.read(path2)).to.eventually.deep.equal(testData)
    await expect(compressed.exists(path1)).to.become(false)
    await expect(compressed.exists(path2)).to.become(true)
  })

  it('compressed.exists(path) works', async function () {
    const path = [testFolder, randomName()]
    await compressed.write(path, Buffer.from('hello friend'))
    await expect(compressed.exists(path)).to.become(true)
    await expect(compressed.exists([testFolder, randomName()])).to.become(false)
  })

  it('compressed.iterateFiles(path)', async function () {
    const files = ['foo', 'bar', 'yes', '💾', 'no']
    const folders = ['groupA', 'groupB', '🍃']

    // empty the file tests, and create a whole structure
    for (const file of files) await compressed.write([testFolder, file], Buffer.from('test'))
    for (const folder of folders) await compressed.write([testFolder, folder, 'inside'], Buffer.from('test'))

    // iterate files, and folders, and compare notes
    const output = await asyncIterableToArray(compressed.iterateFiles([testFolder]))
    expect(output.sort()).to.deep.equal(files.sort())
  })

  it('compressed.iterateFolders(path)', async function () {
    const files = ['foo', 'bar', 'yes', '💾', 'no']
    const folders = ['groupA', 'groupB', '🍃']

    // empty the file tests, and create a whole structure
    await Promise.all([
      ...files.map(file => compressed.write([testFolder, file], Buffer.from('test'))),
      ...folders.map(folder => compressed.write([testFolder, folder, 'inside'], Buffer.from('test')))
    ])

    // iterate files, and folders, and compare notes
    const output = await asyncIterableToArray(compressed.iterateFolders([testFolder]))
    expect(output.sort()).to.deep.equal(folders.sort())
  })

  it('compressed.writeIter(path, generator) accepts a generators', async () => {
    function * syncGen () {
      for (let i = 0; i < 3; i++) yield Buffer.from(`${i}\n`)
    }

    await compressed.writeIter([testFolder, 'sync-generator'], syncGen())
    expect(await compressed.read([testFolder, 'sync-generator'])).to.deep.equal(Buffer.from('0\n1\n2\n'))

    async function * asyncGen () {
      for (let i = 0; i < 3; i++) {
        await delay(1)
        yield Buffer.from(`${i}\n`)
      }
    }

    await compressed.writeIter([testFolder, 'async-generator'], asyncGen())
    expect(await compressed.read([testFolder, 'async-generator'])).to.deep.equal(Buffer.from('0\n1\n2\n'))
  })

  it('compressed.writeIter(path, generator) passes generator errors through', async () => {
    async function * errGenerator () {
      throw new Error('foo')
    }

    await expect(compressed.writeIter([testFolder, 'err-generator'], errGenerator())).to.be.rejectedWith('foo')
    expect(await compressed.exists([testFolder, 'err-generator'])).to.be.false
  })

  it('compressed.appendIter(path, generator) accepts a generators', async () => {
    const path = [testFolder, 'sync-generator-append']

    function * syncGen () {
      for (let i = 0; i < 1024; i++) yield Buffer.from(`${i}\n`)
    }

    await compressed.write(path, Buffer.from('prefix:'))
    await compressed.appendIter(path, syncGen())
    const expecting = Buffer.concat([Buffer.from('prefix:'), ...syncGen()])
    expect(expecting.toString('hex')).to.equal((await compressed.read(path)).toString('hex'))

    async function * asyncGen () {
      for (let i = 0; i < 10; i++) {
        await delay(1)
        yield Buffer.from(`${i}\n`)
      }
    }

    await compressed.appendIter([testFolder, 'async-generator-append'], asyncGen())
    const expecting2 = Buffer.concat(await asyncIterableToArray(asyncGen()))
    expect(expecting2.toString('hex')).to.equal((await compressed.read([testFolder, 'async-generator-append'])).toString('hex'))
  })

  it('compressed.appendIter(path, generator) passes generator errors through', async () => {
    async function * errGenerator () {
      await delay(1)
      throw new Error('foo')
    }

    await expect(compressed.appendIter([testFolder, 'err-generator-append'], errGenerator())).to.be.rejectedWith('foo')
    expect(await compressed.exists([testFolder, 'err-generator-append'])).to.be.false
  })
})
