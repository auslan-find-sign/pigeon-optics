const chai = require('chai')
chai.use(require('chai-as-promised'))
const assert = chai.assert
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
    assert(hash.equals(hash2), 'the buffers should be equal')
    mess.push(hash)
  })

  it('attachments.readMeta(hash) seems to work', async function () {
    const stream = streams.Readable.from(pseudorandom('readMeta test', 100))
    const hash = await attachments.writeStream(stream, { linkers: ['/datasets/system:attachments-test/records/readMetaTest'] })
    const stream2 = streams.Readable.from(pseudorandom('readMeta test', 100))
    const hash2 = await attachments.writeStream(stream2, { linkers: ['/datasets/system:attachments-test/records/readMetaTest2'] })
    assert(hash.equals(hash2), 'the hash outputs should be equal')
    const meta = await attachments.readMeta(hash)
    assert.strictEqual(typeof meta, 'object', 'metadata should be an object')
    assert.strictEqual(typeof meta.created, 'number', 'created field should be a number')
    assert.strictEqual(typeof meta.updated, 'number', 'created field should be a number')
    assert.deepStrictEqual(meta.linkers.sort(), [
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
    assert(Buffer.concat(testData).equals(Buffer.concat(outputData)), 'buffers should be equal')
    mess.push(hash)
  })

  it('attachments.getPath(hash) works', async function () {
    const testData = [...pseudorandom('getPath test', 100)]
    const input = streams.Readable.from(testData)
    const hash = await attachments.writeStream(input, { linkers: ['/datasets/system:attachments-test/records/getPathTest'] })
    const outputData = await asyncIterableToArray(await fs.createReadStream(attachments.getPath(hash)))
    assert(Buffer.concat(testData).equals(Buffer.concat(outputData)), 'buffers should be equal')
    mess.push(hash)
  })

  it('attachments.has(hash) works', async function () {
    assert.isFalse(await attachments.has(crypto.randomBytes(32)), 'shouldn\'t have a random made up hash')
    const stream = streams.Readable.from(pseudorandom('has test', 100))
    const hash = await attachments.writeStream(stream, { linkers: ['/datasets/system:attachments-test/records/hasTest'] })
    assert.isTrue(await attachments.has(hash), 'real existing hash should exist')
    mess.push(hash)
  })

  it('attachments.validate(hash) works to clean out unlinked attachments', async function () {
    for (const hash of mess) {
      assert.isTrue(await attachments.has(hash), 'attachment mess from previous tests should still exist')
      await attachments.validate(hash)
      assert.isFalse(await attachments.has(hash), 'attachment from test should have been removed')
    }
  })
})
