/* eslint-env mocha */
/* eslint-disable no-unused-expressions */
const chai = require('chai')
chai.use(require('chai-as-promised'))
const { expect } = chai
const objects = require('../library/models/fs/objects')
const crypto = require('crypto')
const toArr = require('../library/utility/async-iterable-to-array')
const fs = require('fs-extra')

const tests = [
  true,
  false,
  5,
  9274,
  0.0001,
  [1, 2, 3],
  [null, null, null],
  null,
  undefined,
  new Date(),
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

function randomName (prefix) {
  return (prefix ? `${prefix}-` : '') + crypto.randomBytes(8).toString('hex')
}

describe('models/fs/objects', function () {
  const testFolder = randomName('fs-objects-tests')

  beforeEach(async () => {
    await fs.remove(objects.resolveSystemPath([testFolder], ''))
  })

  afterEach(async () => {
    await fs.remove(objects.resolveSystemPath([testFolder], ''))
  })

  it('objects.read() and objects.write()', async function () {
    for (const test of tests) {
      const path = [testFolder, randomName()]

      await objects.write(path, test)
      await expect(objects.read(path)).to.eventually.deep.equal(test)
    }
  })

  it('objects.append()', async function () {
    const path = [testFolder, 'append-test']
    for (const test of tests) await objects.append(path, test)

    const output = await toArr(objects.readIter(path))
    expect(output).to.deep.equal(tests)
  })

  it('objects.writeIter() and objects.readIter()', async function () {
    const path = [testFolder, randomName()]
    await objects.writeIter(path, tests)
    const output = await toArr(objects.readIter(path))
    expect(output).to.deep.equal(tests)
  })

  it('objects.appendIter()', async function () {
    const path = [testFolder, randomName()]
    // create the file implicitly with appendStream
    await objects.appendIter(path, tests)
    const output = await toArr(objects.readIter(path))
    expect(output).to.deep.equal(tests)
    // append the test data again, so it's there twice, checking that it does actually append and not truncate
    await objects.appendIter(path, tests)
    const output2 = await toArr(objects.readIter(path))
    expect(output2).to.deep.equal([...tests, ...tests])
  })

  it('objects.delete() works', async function () {
    const path = [testFolder, randomName()]
    await objects.write(path, { data: 'Green tea is an effective way to reduce histamine activity in the body' })
    await objects.delete(path)
    await expect(objects.read(path)).to.be.rejected
  })

  it('objects.delete() silently does nothing when the specified path already doesn\'t exist', async function () {
    const path = [testFolder, randomName()]
    await objects.delete(path)
    await objects.delete(path)
    await expect(objects.read(path)).to.be.rejected
  })

  it('objects.update() concurrent requests queue and don\'t clobber', async function () {
    const path = [testFolder, randomName()]
    await objects.write(path, { counter: 0 })
    await Promise.all((new Array(100)).fill(true).map(async () => {
      await objects.update(path, data => {
        return { counter: data.counter + 1 }
      })
    }))

    const data = await objects.read(path)
    expect(data).to.deep.equal({ counter: 100 })
  })

  it('objects.update() works on non-existing files to create them', async function () {
    const path = [testFolder, randomName('new-updated-file')]
    await objects.update(path, data => {
      expect(data).to.be.undefined
      return { hello: 'world' }
    })

    await expect(objects.read(path)).to.eventually.deep.equal({ hello: 'world' })
  })

  it('objects.updateIter() works', async function () {
    const path = [testFolder, 'updateIter']
    await objects.writeIter(path, tests)

    // update them all to be wrapped
    await objects.updateIter(path, async function * (entries) {
      for await (const entry of entries) {
        yield { entry }
      }
    })

    // check it worked
    expect(await toArr(objects.readIter(path))).to.deep.equal(tests.map(entry => ({ entry })))
  })

  it('objects.exists() works', async function () {
    const path = [testFolder, randomName()]
    await objects.write(path, { msg: 'hello friend' })
    await expect(objects.exists(path)).to.become(true)
    await expect(objects.exists([testFolder, randomName()])).to.become(false)
  })

  it('objects.rename()', async function () {
    const path1 = [testFolder, 'initial']
    const path2 = [testFolder, 'renamed']
    await objects.write(path1, '🧧')
    expect(await objects.read(path1)).to.equal('🧧')
    await objects.rename(path1, path2)
    expect(await objects.read(path2)).to.equal('🧧')
  })

  it('objects.iterateFiles()', async function () {
    const files = ['foo', 'bar', 'yes', '💾', 'no']
    const folders = ['groupA', 'groupB', '🍃']

    // empty the file tests, and create a whole structure
    for (const file of files) await objects.write([testFolder, file], { test: true })
    for (const folder of folders) await objects.write([testFolder, folder, 'inside'], { test: true })

    // iterate files, and folders, and compare notes
    const output = await toArr(objects.iterateFiles([testFolder]))
    expect(output.sort()).to.deep.equal(files.sort())
  })

  it('objects.iterateFolders()', async function () {
    const files = ['foo', 'bar', 'yes', '💾', 'no']
    const folders = ['groupA', 'groupB', '🍃']

    // empty the file tests, and create a whole structure
    for (const file of files) await objects.write([testFolder, file], { test: true })
    for (const folder of folders) await objects.write([testFolder, folder, 'inside'], { test: true })

    // iterate files, and folders, and compare notes
    const output = await toArr(objects.iterateFolders([testFolder]))
    expect(output.sort()).to.deep.equal(folders.sort())
  })

  it('objects.iterateFilesAndFolders()', async function () {
    const files = ['foo', 'bar', 'yes', '💾', 'no']
    const folders = ['groupA', 'groupB', '🍃']

    // empty the file tests, and create a whole structure
    for (const file of files) await objects.write([testFolder, file], { test: true })
    for (const folder of folders) await objects.write([testFolder, folder, 'inside'], { test: true })

    // iterate files, and folders, and compare notes
    const output = await toArr(objects.iterateFilesAndFolders([testFolder]))
    expect(output.map(x => x.file).filter(x => !!x).sort()).to.deep.equal(files.sort())
    expect(output.map(x => x.folder).filter(x => !!x).sort()).to.deep.equal(folders.sort())
  })
})
