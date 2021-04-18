/* eslint-disable no-unused-expressions */
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
    const write1 = await attachments.writeStream(stream, { linkers: ['/datasets/system:attachments-test/records/writeStream'] })
    const stream2 = streams.Readable.from(pseudorandom('writeStream test', 500)) // 16kb of data
    const write2 = await attachments.writeStream(stream2, { linkers: ['/datasets/system:attachments-test/records/writeStream2'] })
    expect(write1.hash.toString('hex')).to.deep.equal(write2.hash.toString('hex'))
    mess.push(write1, write2)
  })

  it('attachments.readMeta(hash) and .link() seems to work', async function () {
    const stream = streams.Readable.from(pseudorandom('readMeta test', 100))
    const write1 = await attachments.writeStream(stream, { linkers: ['/datasets/system:attachments-test/records/readMetaTest'] })
    const stream2 = streams.Readable.from(pseudorandom('readMeta test', 100))
    const write2 = await attachments.writeStream(stream2, { linkers: ['/datasets/system:attachments-test/records/readMetaTest2'] })
    expect(write1.hash.toString('hex')).to.deep.equal(write2.hash.toString('hex'))
    await attachments.link(write1.hash, '/datasets/system:attachments-test/records/linked')
    const meta = await attachments.readMeta(write1.hash)
    expect(meta).to.be.a('object')
    expect(meta.created).to.be.a('number')
    expect(meta.updated).to.be.a('number')
    expect(meta.linkers).to.deep.equal([
      '/datasets/system:attachments-test/records/readMetaTest',
      '/datasets/system:attachments-test/records/readMetaTest2',
      '/datasets/system:attachments-test/records/linked'
    ])
    mess.push(write1, write2)
  })

  it('attachments.readStream(hash) works', async function () {
    const testData = [...pseudorandom('readStream test', 100)]
    const input = streams.Readable.from(testData)
    const write = await attachments.writeStream(input, { linkers: ['/datasets/system:attachments-test/records/readStreamTest'] })
    const outputData = await asyncIterableToArray(await attachments.readStream(write.hash))
    expect(Buffer.concat(testData).equals(Buffer.concat(outputData))).to.be.true
    mess.push(write)
  })

  it('attachments.getPath(hash) works', async function () {
    const testData = [...pseudorandom('getPath test', 100)]
    const input = streams.Readable.from(testData)
    const write = await attachments.writeStream(input, { linkers: ['/datasets/system:attachments-test/records/getPathTest'] })
    const outputData = await asyncIterableToArray(await fs.createReadStream(attachments.getPath(write.hash)))
    expect(Buffer.concat(testData)).to.deep.equal(Buffer.concat(outputData))
    mess.push(write)
  })

  it('attachments.has(hash) works', async function () {
    await expect(attachments.has(crypto.randomBytes(32))).to.eventually.be.false
    const stream = streams.Readable.from(pseudorandom('has test', 100))
    const write = await attachments.writeStream(stream, { linkers: ['/datasets/system:attachments-test/records/hasTest'] })
    await expect(attachments.has(write.hash)).to.eventually.be.true
    mess.push(write)
  })

  it('attachments.writeStream() ⨉ 10 concurrently works', async function () {
    const jobs = []
    for (let i = 0; i < 10; i++) {
      const stream = streams.Readable.from(pseudorandom('concurrency!', 100))
      jobs.push(attachments.writeStream(stream, { linkers: [`/datasets/system:attachments-test/records/concurrentWrite${i}`] }))
    }

    const results = await Promise.all(jobs)
    // check all the hashes are identical
    expect(results.map(x => x.hash.toString('hex'))).to.deep.equal((new Array(10)).fill(results[0].hash.toString('hex')))
    await expect(attachments.has(results[0].hash)).to.eventually.be.true
    while (results.length > 0) {
      const next = results.shift()
      const released = await next.release()
      if (released) {
        expect(results).to.have.length(0)
        await expect(attachments.has(next.hash)).to.eventually.be.false
      } else {
        expect(results).to.have.length.above(0)
        await expect(attachments.has(next.hash)).to.eventually.be.true
      }
    }
  })

  it('attachments.validate(hash) works to clean out unlinked attachments', async function () {
    const messHashes = new Set(mess.map(x => x.hash.toString('hex')))
    // validate all the mess attachment blobs are still present
    const presentHashes = await (await Promise.all([...messHashes].map(async (hash) => await attachments.has(hash) ? hash : false))).filter(x => x)
    expect(presentHashes).to.deep.equal([...messHashes])
    // release all the holds
    await Promise.all(mess.map(x => x.release()))
    // validate all the mess hashes are removed
    const presentAfter = await (await Promise.all([...messHashes].map(async (hash) => await attachments.has(hash) ? hash : false))).filter(x => x)
    expect(presentAfter).to.deep.equal([])
  })
})
