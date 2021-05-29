const chai = require('chai')
chai.use(require('chai-as-promised'))
const { expect } = chai
const crypto = require('crypto')
const createHttpError = require('http-errors')
const delay = require('delay')
const dataset = require('../library/models/dataset')
const account = 'system'
const name = 'test-models-dataset'

function fakehash (size = 8000) {
  const data = crypto.randomBytes(size)
  const digest = crypto.createHash('sha256')
  digest.update(data)
  const hash = digest.digest()
  const hashURL = `hash://sha256/${hash.toString('hex')}?type=${encodeURIComponent('application/octet-stream')}`
  return { hash, hashURL, data }
}

describe('models/dataset', function () {
  before(async function () {
    await dataset.delete(account, name)
  })

  it('dataset.create(account, name) sets up a dataset with a memo', async function () {
    await dataset.create(account, name, {
      memo: 'Automated Unit Testing created this dataset to verify internal models are working correctly'
    })
    await expect(dataset.readMeta(account, name)).eventually.property('memo').does.include('Automated Unit Testing')
  })

  it('dataset.updateMeta() carries errors correctly', async function () {
    await expect(dataset.updateMeta(account, name, meta => {
      throw new Error('chaos emerald')
    })).to.be.rejectedWith('chaos')

    await expect(dataset.updateMeta(account, name, async meta => {
      await delay(10)
      throw new Error('chaos 2')
    })).to.be.rejectedWith('chaos')
  })

  it('dataset.write(account, name, recordID, data) works', async function () {
    await dataset.write(account, name, 'test-1', {
      hello: 'world'
    })
  })

  it('dataset.read(account, name, recordID) works', async function () {
    await expect(dataset.read(account, name, 'test-1')).to.eventually.deep.equal({ hello: 'world' })
  })

  it('dataset.readMeta(account, name) contains correct versions', async function () {
    const meta = await dataset.readMeta(account, name)
    expect(meta).to.have.all.keys('memo', 'version', 'updated', 'created', 'records')
    expect(meta.memo).to.equal('Automated Unit Testing created this dataset to verify internal models are working correctly')
    expect(meta.version).to.equal(1)
    expect(meta.records).to.have.all.keys('test-1')
    expect(meta.records['test-1'].version).to.equal(1)
    expect(meta.records['test-1']).to.have.all.keys('hash', 'version', 'links')
  })

  it('dataset.merge(account, name, records) works as expected', async function () {
    await dataset.merge(account, name, {
      'test-2': 1,
      'test-3': Buffer.from('looks good?')
    })
    const meta = await dataset.readMeta(account, name)
    expect(meta.version).to.equal(2)
    expect(meta.records).has.all.keys('test-1', 'test-2', 'test-3')
    await expect(dataset.read(account, name, 'test-2')).to.eventually.equal(1)
    await expect(dataset.read(account, name, 'test-3')).to.eventually.be.a('Uint8Array')
  })

  it('dataset.list(account)', async function () {
    await expect(dataset.list(crypto.randomBytes(16).toString('hex'))).is.rejectedWith(createHttpError.NotFound)
    await expect(dataset.list(account)).to.eventually.deep.equal([name])
  })

  it('dataset.list(account, name)', async function () {
    const list = await dataset.list(account, name)
    expect(list.map(x => x.id).sort()).to.deep.equal(['test-1', 'test-2', 'test-3'].sort())
    const test3 = list.find(x => x.id === 'test-3')
    expect(test3.version).to.equal(2)
    expect(test3.hash).to.be.a('Uint8Array')
    expect(test3.hash.length).to.equal(32)
    const read = await test3.read()
    expect(read).to.be.a('Uint8Array')
    expect(read).to.deep.equal(Buffer.from('looks good?'))
  })

  it('dataset.overwrite(account, name, records) works as expected', async function () {
    await dataset.overwrite(account, name, { abc: 123, def: 456 })
    const meta = await dataset.readMeta(account, name)
    expect(meta.version).to.equal(3)
    expect(meta.records).has.all.keys('abc', 'def')
    await expect(dataset.read(account, name, 'abc')).to.eventually.equal(123)
    await expect(dataset.read(account, name, 'def')).to.eventually.equal(456)
  })

  it('dataset.write() with same value doesn\'t change version number', async function () {
    await dataset.write(account, name, 'def', 456)
    const meta = await dataset.readMeta(account, name)
    expect(meta.version).to.equal(4)
    expect(meta.records.abc.version).to.equal(3)
    expect(meta.records.def.version).to.equal(3)
  })

  it('dataset.exists() works correctly', async function () {
    await expect(dataset.exists(account, name)).to.eventually.be.true
    await expect(dataset.exists(account, name, 'abc')).to.eventually.be.true
    await expect(dataset.exists(account, name, 'def')).to.eventually.be.true
    await expect(dataset.exists(account, name, 'xyz')).to.eventually.be.false
    await expect(dataset.exists(account, name, 'test-1')).to.eventually.be.false
    await expect(dataset.exists(account, 'fake-dataset-doesnt-exist')).to.eventually.be.false
    await expect(dataset.exists(account, 'fake-dataset-doesnt-exist', 'non-existing-record')).to.eventually.be.false
  })

  it('dataset.delete(account, name, record) works', async function () {
    await dataset.delete(account, name, 'def')
    const meta = await dataset.readMeta(account, name)
    expect(meta.records).has.all.keys('abc')
    expect(meta.version).does.equal(5)
  })

  it('dataset.write() throws for missing hashURLs', async function () {
    const { hashURL } = fakehash()
    const prom = dataset.write(account, name, 'attach', { file: hashURL })
    await expect(prom).to.be.rejectedWith(createHttpError.BadRequest)
  })

  it('dataset.merge() throws for missing hashURLs', async function () {
    const { hashURL } = fakehash()
    const prom = dataset.merge(account, name, { r1: { msg: 'test' }, r2: { file: hashURL } })
    await expect(prom).to.be.rejectedWith(createHttpError.BadRequest)
  })

  it('dataset.overwrite() throws for missing hashURLs', async function () {
    const { hashURL } = fakehash()
    const prom = dataset.overwrite(account, name, { A: { msg: 'test' }, B: { file: hashURL } })
    await expect(prom).to.be.rejectedWith(createHttpError.BadRequest)
  })

  it('dataset.delete(account, name) works', async function () {
    await expect(dataset.exists(account, name)).to.eventually.be.true
    await expect(dataset.exists(account, name, 'abc')).to.eventually.be.true
    await dataset.delete(account, name)
    await expect(dataset.exists(account, name)).to.eventually.be.false
    await expect(dataset.exists(account, name, 'abc')).to.eventually.be.false
  })
})
