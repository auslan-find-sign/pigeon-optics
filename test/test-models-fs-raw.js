/* eslint-env mocha */
/* eslint-disable no-unused-expressions */
const asyncIterableToArray = require('../library/utility/async-iterable-to-array')
const crypto = require('crypto')
const chai = require('chai')
chai.use(require('chai-as-promised'))
const expect = chai.expect
const raw = require('../library/models/fs/raw')
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

describe('models/fs/raw', function () {
  this.timeout(500)
  this.slow(250)

  const testFolder = randomName('fs-raw-tests')

  beforeEach(async () => {
    await fs.remove(raw.resolveSystemPath([testFolder], ''))
  })

  afterEach(async () => {
    await fs.remove(raw.resolveSystemPath([testFolder], ''))
  })

  it('raw.read(path)', async function () {
    // generate a random data path
    const path = [testFolder, randomName()]
    // generate 512kb of random data
    const testData = crypto.randomBytes(1024 * 512)
    // use known good fs module to write it to a file
    await fs.outputFile(raw.resolveSystemPath(path, raw.fileExtension), testData)

    // read it out using the raw.read function
    const readback = await raw.read(path)
    // check it matches exactly
    expect(testData).to.deep.equal(readback)
  })

  it('raw.write(path, data)', async function () {
    // generate a random data path
    const path = [testFolder, randomName()]
    // generate 512kb of random data
    const testData = crypto.randomBytes(1024 * 512)
    await raw.write(path, testData)
    // use known good fs module to read out the data
    const readback = await fs.readFile(raw.resolveSystemPath(path, raw.fileExtension))
    // check it matches exactly
    expect(testData).to.deep.equal(readback)
  })

  it('raw.read(path) and raw.write(path, buffer)', async function () {
    for (const test of tests) {
      const path = [testFolder, randomName()]

      await raw.write(path, test)
      const data = await raw.read(path)
      expect(data).is.a('Uint8Array')
      expect(data.equals(test)).to.equal(true)
    }
  })

  it('raw.append(path, buffer)', async function () {
    const path = [testFolder, randomName()]
    for (const test of tests) await raw.append(path, test)
    expect(Buffer.concat(tests).equals(await raw.read(path))).to.equal(true)
  })

  it('raw.writeIter(path, iterable)', async function () {
    for (const test of tests) {
      const path = [testFolder, randomName()]
      await raw.writeIter(path, [test])
      const data = await raw.read(path)
      expect(data.equals(test)).to.equal(true)
    }
  })

  it('raw.appendIter(path, iterable)', async function () {
    const path = [testFolder, randomName()]
    await raw.appendIter(path, tests)
    const readback = await raw.read(path)
    expect(readback.equals(Buffer.concat(tests))).to.equal(true)
  })

  it('raw.readIter(path)', async function () {
    const path = [testFolder, randomName()]
    await raw.write(path, Buffer.from('foobar'))
    const chunks = await asyncIterableToArray(raw.readIter(path, { chunkSize: 2 }))
    expect(chunks).to.be.an('array').and.have.lengthOf(3)
    expect(Buffer.concat(chunks).toString('utf-8')).to.equal('foobar')
  })

  it('raw.readIter(fakePath) errors well', async function () {
    const path = [testFolder, randomName('fake-path')]
    await expect(asyncIterableToArray(raw.readIter(path))).to.be.rejectedWith('ENOENT')
  })

  it('raw.delete(path) works', async function () {
    const path = [testFolder, randomName()]
    await raw.write(path, Buffer.from('Green tea is an effective way to reduce histamine activity in the body'))
    await raw.delete(path)
    await expect(raw.read(path)).to.be.rejected
  })

  it('raw.delete(path) silently does nothing when the specified path already doesn\'t exist', async function () {
    const path = [testFolder, randomName()]
    await raw.delete(path)
    await raw.delete(path)
    await expect(raw.read(path)).to.be.rejected
  })

  it('raw.update(path, cb(buffer)) concurrent requests queue and don\'t clobber', async function () {
    const path = [testFolder, randomName()]
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

  it('raw.rename(path1, path2) works', async function () {
    const path1 = [testFolder, randomName()]
    const path2 = [testFolder, randomName()]
    const testData = crypto.randomBytes(64)
    await raw.write(path1, testData)
    await expect(raw.read(path1)).to.eventually.deep.equal(testData)
    await raw.rename(path1, path2)
    await expect(raw.read(path2)).to.eventually.deep.equal(testData)
    await expect(raw.exists(path1)).to.become(false)
    await expect(raw.exists(path2)).to.become(true)
  })

  it('raw.exists(path) works', async function () {
    const path = [testFolder, randomName()]
    await raw.write(path, Buffer.from('hello friend'))
    await expect(raw.exists(path)).to.become(true)
    await expect(raw.exists([testFolder, randomName()])).to.become(false)
  })

  it('raw.iterateFiles(path)', async function () {
    const files = ['foo', 'bar', 'yes', '💾', 'no']
    const folders = ['groupA', 'groupB', '🍃']

    // empty the file tests, and create a whole structure
    for (const file of files) await raw.write([testFolder, file], Buffer.from('test'))
    for (const folder of folders) await raw.write([testFolder, folder, 'inside'], Buffer.from('test'))

    // iterate files, and folders, and compare notes
    const output = await asyncIterableToArray(raw.iterateFiles([testFolder]))
    expect(output.sort()).to.deep.equal(files.sort())
  })

  it('raw.iterateFolders(path)', async function () {
    const files = ['foo', 'bar', 'yes', '💾', 'no']
    const folders = ['groupA', 'groupB', '🍃']

    // empty the file tests, and create a whole structure
    await Promise.all([
      ...files.map(file => raw.write([testFolder, file], Buffer.from('test'))),
      ...folders.map(folder => raw.write([testFolder, folder, 'inside'], Buffer.from('test')))
    ])

    // iterate files, and folders, and compare notes
    const output = await asyncIterableToArray(raw.iterateFolders([testFolder]))
    expect(output.sort()).to.deep.equal(folders.sort())
  })

  it('raw.writeIter(path, generator) accepts a generators', async () => {
    function * syncGen () {
      for (let i = 0; i < 3; i++) yield Buffer.from(`${i}\n`)
    }

    await raw.writeIter([testFolder, 'sync-generator'], syncGen())
    expect(await raw.read([testFolder, 'sync-generator'])).to.deep.equal(Buffer.from('0\n1\n2\n'))

    async function * asyncGen () {
      for (let i = 0; i < 3; i++) {
        await delay(1)
        yield Buffer.from(`${i}\n`)
      }
    }

    await raw.writeIter([testFolder, 'async-generator'], asyncGen())
    expect(await raw.read([testFolder, 'async-generator'])).to.deep.equal(Buffer.from('0\n1\n2\n'))
  })

  it('raw.writeIter(path, generator) passes generator errors through', async () => {
    async function * errGenerator () {
      throw new Error('foo')
    }

    await expect(raw.writeIter([testFolder, 'err-generator'], errGenerator())).to.be.rejectedWith('foo')
    expect(await raw.exists([testFolder, 'err-generator'])).to.be.false
  })

  it('raw.appendIter(path, generator) accepts a generators', async () => {
    const path = [testFolder, 'sync-generator-append']

    function * syncGen () {
      for (let i = 0; i < 1024; i++) yield Buffer.from(`${i}\n`)
    }

    await raw.write(path, Buffer.from('prefix:'))
    await raw.appendIter(path, syncGen())
    const expecting = Buffer.concat([Buffer.from('prefix:'), ...syncGen()])
    expect(expecting.toString('hex')).to.equal((await raw.read(path)).toString('hex'))

    async function * asyncGen () {
      for (let i = 0; i < 10; i++) {
        await delay(1)
        yield Buffer.from(`${i}\n`)
      }
    }

    await raw.appendIter([testFolder, 'async-generator-append'], asyncGen())
    const expecting2 = Buffer.concat(await asyncIterableToArray(asyncGen()))
    expect(expecting2.toString('hex')).to.equal((await raw.read([testFolder, 'async-generator-append'])).toString('hex'))
  })

  it('raw.appendIter(path, generator) passes generator errors through', async () => {
    async function * errGenerator () {
      await delay(1)
      throw new Error('foo')
    }

    await expect(raw.appendIter([testFolder, 'err-generator-append'], errGenerator())).to.be.rejectedWith('foo')
    expect(await raw.exists([testFolder, 'err-generator-append'])).to.be.false
  })
})
