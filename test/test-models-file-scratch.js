const { file, ScratchFile } = require('../library/models/file/scratch')
const chai = require('chai')
const expect = chai.expect
const crypto = require('crypto')

const testData = [
  'foo',
  { a: 1, b: 2 },
  crypto.randomBytes(32),
  Date.now(),
  new Date(),
  Infinity,
  -Infinity,
  [0, -1, -2]
]

describe('models/file/scratch', () => {
  /** @type {ScratchFile} */
  let scratch

  it('file() creates a scratch', async () => {
    scratch = await file()
    expect(scratch).is.instanceOf(ScratchFile)
  })

  let reads
  it('scratch.write stores stuff', async () => {
    reads = await Promise.all(testData.map(x => scratch.write(x)))
  })

  it('read functions work to recall those objects', async () => {
    const readback = await Promise.all(reads.map(read => read()))

    expect(readback).to.deep.equal(testData)
  })

  it('closes', async () => {
    await scratch.close()
  })
})
