const chai = require('chai')
chai.use(require('chai-as-promised'))
const { expect } = chai
const crypto = require('crypto')
const createHttpError = require('http-errors')
const delay = require('delay')
const dataset = require('../library/models/dataset')
const account = 'system'
const name = 'test-models-dataset'
const memo = 'Automated Unit Testing created this dataset to verify internal models are working correctly'

function fakehash (size = 8000) {
  const data = crypto.randomBytes(size)
  const digest = crypto.createHash('sha256')
  digest.update(data)
  const hash = digest.digest()
  const hashURL = `hash://sha256/${hash.toString('hex')}?type=${encodeURIComponent('application/octet-stream')}`
  return { hash, hashURL, data }
}

describe('models/dataset', function () {
  beforeEach(async () => await dataset.delete(account, name))
  afterEach(async () => await dataset.delete(account, name))

  it('dataset.create(account, name) reads back with readMemo(account, name)', async () => {
    await dataset.create(account, name, { memo })
    await expect(dataset.readMeta(account, name)).eventually.property('memo').does.include('Automated Unit Testing')
  })

  it('dataset.updateMeta() carries errors correctly', async () => {
    await dataset.create(account, name, { memo })

    await expect(dataset.updateMeta(account, name, meta => {
      throw new Error('chaos emerald')
    })).to.be.rejectedWith('chaos')

    await expect(dataset.updateMeta(account, name, async meta => {
      await delay(10)
      throw new Error('chaos 2')
    })).to.be.rejectedWith('chaos')
  })

  it('dataset.write(account, name, recordID, data) works', async () => {
    await dataset.create(account, name, { memo })
    await dataset.write(account, name, 'test-1', { hello: 'world' })
  })

  it('dataset.read(account, name, recordID) works', async () => {
    await dataset.create(account, name, { memo })
    await dataset.write(account, name, 'test-1', { hello: 'world' })
    await expect(dataset.read(account, name, 'test-1')).to.eventually.deep.equal({ hello: 'world' })
  })

  it('dataset.readMeta(account, name) contains correct versions', async () => {
    await dataset.create(account, name, { memo })
    await dataset.write(account, name, 'test-1', { hello: 'world' })
    const meta = await dataset.readMeta(account, name)
    expect(meta).to.have.all.keys('memo', 'version', 'updated', 'created', 'records')
    expect(meta.memo).to.equal('Automated Unit Testing created this dataset to verify internal models are working correctly')
    expect(meta.version).to.equal(1)
    expect(meta.records).to.have.all.keys('test-1')
    expect(meta.records['test-1'].version).to.equal(1)
    expect(meta.records['test-1']).to.have.all.keys('hash', 'version', 'links')
  })

  it('dataset.merge(account, name, records) works as expected', async () => {
    await dataset.create(account, name, { memo })
    await dataset.write(account, name, 'test-1', { hello: 'world' })
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

  it('dataset.list(account)', async () => {
    await dataset.create(account, name, { memo })
    await dataset.write(account, name, 'test-1', { hello: 'world' })
    await expect(dataset.list(crypto.randomBytes(16).toString('hex'))).is.rejectedWith(createHttpError.NotFound)
    await expect(dataset.list(account)).to.eventually.deep.equal([name])
  })

  it('dataset.list(account, name)', async () => {
    await dataset.create(account, name, { memo })
    await dataset.write(account, name, 'test-1', { hello: 'world' })
    await dataset.write(account, name, 'test-2', { hello: 'world' })
    await dataset.write(account, name, 'test-3', { hello: 'world' })
    const list = await dataset.list(account, name)
    expect(list.map(x => x.id).sort()).to.deep.equal(['test-1', 'test-2', 'test-3'].sort())
    const test2 = list.find(x => x.id === 'test-2')
    expect(test2.version).to.equal(2)
    expect(test2.hash).to.be.a('string')
    expect(test2.hash.length).to.equal(64)
    const read = await test2.read()
    expect(read).to.be.a('object')
    expect(read).to.deep.equal({ hello: 'world' })
  })

  it('dataset.overwrite(account, name, records) works as expected', async function () {
    await dataset.create(account, name, { memo })
    await dataset.write(account, name, 'abc', 987)
    await dataset.write(account, name, 'test-2', { hello: 'world' })
    await dataset.write(account, name, 'test-3', { hello: 'world' })
    await dataset.overwrite(account, name, { abc: 123, def: 456 })
    const meta = await dataset.readMeta(account, name)
    expect(meta.records).has.all.keys('abc', 'def')
    await expect(dataset.read(account, name, 'abc')).to.eventually.equal(123)
    await expect(dataset.read(account, name, 'def')).to.eventually.equal(456)
  })

  it('dataset.write() with same value doesn\'t change version number', async function () {
    await dataset.create(account, name, { memo })
    await dataset.write(account, name, 'abc', 'hey')
    await dataset.write(account, name, 'abc', 'hey')
    const meta = await dataset.readMeta(account, name)
    expect(meta.version).to.equal(2)
    expect(meta.records.abc.version).to.equal(1)
  })

  it('dataset.exists() works correctly', async function () {
    await expect(dataset.exists(account, name)).to.eventually.be.false
    await dataset.create(account, name, { memo })
    await expect(dataset.exists(account, name)).to.eventually.be.true
    await expect(dataset.exists(account, name, 'abc')).to.eventually.be.false
    await dataset.write(account, name, 'abc', 123)
    await expect(dataset.exists(account, name)).to.eventually.be.true
    await expect(dataset.exists(account, name, 'abc')).to.eventually.be.true

    await expect(dataset.exists(account, 'fake-dataset-doesnt-exist')).to.eventually.be.false
    await expect(dataset.exists(account, 'fake-dataset-doesnt-exist', 'non-existing-record')).to.eventually.be.false
  })

  it('dataset.delete(account, name, record) works', async function () {
    await dataset.create(account, name, { memo })
    await dataset.overwrite(account, name, { abc: 123, def: 456 })

    await dataset.delete(account, name, 'def')
    const meta = await dataset.readMeta(account, name)
    expect(meta.records).has.all.keys('abc')
    expect(meta.version).does.equal(2)
  })

  it('dataset.write() throws for missing hashURLs', async function () {
    await dataset.create(account, name, { memo })

    const { hashURL } = fakehash()
    const prom = dataset.write(account, name, 'attach', { file: hashURL })
    await expect(prom).to.be.rejectedWith(createHttpError.BadRequest)
  })

  it('dataset.merge() throws for missing hashURLs', async function () {
    await dataset.create(account, name, { memo })

    const { hashURL } = fakehash()
    const prom = dataset.merge(account, name, { r1: { msg: 'test' }, r2: { file: hashURL } })
    await expect(prom).to.be.rejectedWith(createHttpError.BadRequest)
  })

  it('dataset.overwrite() throws for missing hashURLs', async function () {
    await dataset.create(account, name, { memo })

    const { hashURL } = fakehash()
    const prom = dataset.overwrite(account, name, { A: { msg: 'test' }, B: { file: hashURL } })
    await expect(prom).to.be.rejectedWith(createHttpError.BadRequest)
  })

  it('dataset.delete(account, name) works', async function () {
    await dataset.create(account, name, { memo })
    await dataset.overwrite(account, name, { abc: 123, def: 456 })

    await expect(dataset.exists(account, name)).to.eventually.be.true
    await expect(dataset.exists(account, name, 'abc')).to.eventually.be.true
    await dataset.delete(account, name)
    await expect(dataset.exists(account, name)).to.eventually.be.false
    await expect(dataset.exists(account, name, 'abc')).to.eventually.be.false
  })
})
