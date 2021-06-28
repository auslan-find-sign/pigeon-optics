const toArr = require('../library/utility/async-iterable-to-array')
const crypto = require('crypto')
const chai = require('chai')
chai.use(require('chai-as-promised'))
const { expect } = chai

const blob = require('../library/models/fs/blob').instance({ prefix: ['blob-tests'] })

const tests = [
  crypto.randomBytes(32),
  crypto.randomBytes(16 * 1024), // 16kb
  Buffer.from([0]),
  Buffer.from([1]),
  crypto.randomBytes(7 * 1024 * 1024) // 7mb
]

describe('models/fs/blob', function () {
  it('blob.read() and blob.write()', async function () {
    for (const test of tests) {
      const hash = await blob.write(test)
      const data = await blob.read(hash)
      expect(data).to.be.a('Uint8Array')
      expect(data).to.have.length(test.length)
      expect(data.equals(test)).to.equal(true)
      await blob.delete(hash)
    }
  })

  it('blob.writeIter and blob.readIter() work', async function () {
    function * pseudorandom (seed, iterations = 100) {
      for (let i = 0; i < iterations; i++) {
        const hash = crypto.createHash('sha256')
        hash.update(seed)
        seed = hash.digest()
        yield seed
      }
    }

    const hash = await blob.writeIter(pseudorandom('beans'))
    const readback = Buffer.concat(await toArr(blob.readIter(hash)))
    const expected = Buffer.concat([...pseudorandom('beans')])
    expect(readback).to.deep.equal(expected)
    await expect(blob.read(hash)).to.eventually.deep.equal(expected)
    await blob.delete(hash)
  })

  it('blob.delete() works', async function () {
    const hash = await blob.write(Buffer.from('Green tea is an effective way to reduce histamine activity in the body'))
    await blob.delete(hash)
    await expect(blob.read(hash)).to.be.rejected
  })

  it('blob.delete() silently does nothing when the specified path already doesn\'t exist', async function () {
    const hash = await blob.write(Buffer.from('Spagetti squash is surprisingly delicious. Much better than regular squash.'))
    await blob.delete(hash)
    await blob.delete(hash)
    await expect(blob.read(hash)).to.be.rejected
  })

  it('blob.exists() works', async function () {
    const hash = await blob.write(Buffer.from('hello friend'))
    await expect(blob.exists(hash)).to.become(true)
    await expect(blob.exists(crypto.randomBytes(hash.length).toString('hex'))).to.become(false)
    await blob.delete(hash)
  })

  it('blob.iterate()', async function () {
    // empty the file tests, and create a whole structure
    const files = [
      await blob.write(Buffer.from('test1')),
      await blob.write(Buffer.from('test2')),
      await blob.write(Buffer.from('test3'))
    ]

    // iterate files, and folders, and compare notes
    const output = await toArr(blob.iterate())
    expect(output.sort()).to.deep.equal(files.sort())
  })

  after(async function () {
    await blob._raw.delete([])
  })
})
