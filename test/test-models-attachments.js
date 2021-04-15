const chai = require('chai')
chai.use(require('chai-as-promised'))
const { expect } = chai
const crypto = require('crypto')
const streams = require('stream')
const fs = require('fs')
const attachments = require('../library/models/attachments')
const asyncIterableToArray = require('../library/utility/async-iterable-to-array')

// test data generator, recursively hashes a seed value to create a fixed length of reproducable data
function * pseudorandom (seed, iterations = 100) {
  for (let i = 0; i < iterations; i++) {
    const hash = crypto.createHash('sha256')
    hash.update(seed)
    seed = hash.digest()
    yield seed
  }
}

describe('models/attachments', function () {
  const mess = []

  it('attachments.writeStream(stream, meta) creates something', async function () {
    const stream = streams.Readable.from(pseudorandom('writeStream test', 500)) // 16kb of data
    const hash = await attachments.writeStream(stream, { linkers: ['/datasets/system:attachments-test/records/writeStream'] })
    const stream2 = streams.Readable.from(pseudorandom('writeStream test', 500)) // 16kb of data
    const hash2 = await attachments.writeStream(stream2, { linkers: ['/datasets/system:attachments-test/records/writeStream2'] })
    expect(hash).to.deep.equal(hash2)
    mess.push(hash)
  })

  it('attachments.readMeta(hash) seems to work', async function () {
    const stream = streams.Readable.from(pseudorandom('readMeta test', 100))
    const hash = await attachments.writeStream(stream, { linkers: ['/datasets/system:attachments-test/records/readMetaTest'] })
    const stream2 = streams.Readable.from(pseudorandom('readMeta test', 100))
    const hash2 = await attachments.writeStream(stream2, { linkers: ['/datasets/system:attachments-test/records/readMetaTest2'] })
    expect(hash).to.deep.equal(hash2)
    const meta = await attachments.readMeta(hash)
    expect(meta).to.be.a('object')
    expect(meta.created).to.be.a('number')
    expect(meta.updated).to.be.a('number')
    expect(meta.linkers.sort()).to.deep.equal([
      '/datasets/system:attachments-test/records/readMetaTest',
      '/datasets/system:attachments-test/records/readMetaTest2'
    ].sort())
    mess.push(hash)
  })

  it('attachments.readStream(hash) works', async function () {
    const testData = [...pseudorandom('readStream test', 100)]
    const input = streams.Readable.from(testData)
    const hash = await attachments.writeStream(input, { linkers: ['/datasets/system:attachments-test/records/readStreamTest'] })
    const outputData = await asyncIterableToArray(await attachments.readStream(hash))
    expect(Buffer.concat(testData)).to.deep.equal(Buffer.concat(outputData))
    mess.push(hash)
  })

  it('attachments.getPath(hash) works', async function () {
    const testData = [...pseudorandom('getPath test', 100)]
    const input = streams.Readable.from(testData)
    const hash = await attachments.writeStream(input, { linkers: ['/datasets/system:attachments-test/records/getPathTest'] })
    const outputData = await asyncIterableToArray(await fs.createReadStream(attachments.getPath(hash)))
    expect(Buffer.concat(testData)).to.deep.equal(Buffer.concat(outputData))
    mess.push(hash)
  })

  it('attachments.has(hash) works', async function () {
    await expect(attachments.has(crypto.randomBytes(32))).to.eventually.be.false
    const stream = streams.Readable.from(pseudorandom('has test', 100))
    const hash = await attachments.writeStream(stream, { linkers: ['/datasets/system:attachments-test/records/hasTest'] })
    await expect(attachments.has(hash)).to.eventually.be.true
    mess.push(hash)
  })

  it('attachments.validate(hash) works to clean out unlinked attachments', async function () {
    for (const hash of mess) {
      await expect(attachments.has(hash)).to.eventually.be.true
      await attachments.validate(hash)
      await expect(attachments.has(hash)).to.eventually.be.false
    }
  })
})
