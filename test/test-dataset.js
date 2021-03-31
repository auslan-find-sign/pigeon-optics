const chai = require('chai')
chai.use(require('chai-as-promised'))
const assert = chai.assert
const dataset = require('../library/models/dataset')
const user = 'system'
const name = 'test'

describe('models/dataset', function () {
  it('dataset.create(user, name) sets up a dataset with a memo', async function () {
    await dataset.create(user, name, {
      memo: 'Automated Unit Testing created this dataset to verify internal models are working correctly'
    })
    assert.isTrue((await dataset.readMeta(user, name)).memo.startsWith('Automated Unit Testing'), 'memo should be preserved in new dataset')
  })

  it('dataset.write(user, name, recordID, data) works', async function () {
    await dataset.write(user, name, 'test-1', {
      hello: 'world'
    })
  })

  it('dataset.read(user, name, recordID) works', async function () {
    const read = await dataset.read(user, name, 'test-1')
    assert.deepStrictEqual(read, { hello: 'world' }, 'should read back the same object that was created in the write test')
  })

  it('dataset.readMeta(user, name) contains correct versions', async function () {
    const meta = await dataset.readMeta(user, name)
    assert.hasAllKeys(meta, ['memo', 'version', 'updated', 'created', 'records'])
    assert.equal(meta.memo, 'Automated Unit Testing created this dataset to verify internal models are working correctly')
    assert.equal(meta.version, 1, 'version number should be 1')
    assert.deepStrictEqual(Object.keys(meta.records), ['test-1'])
    assert.equal(meta.records['test-1'].version, 1)
    assert.hasAllKeys(meta.records['test-1'], ['hash', 'version'])
  })

  it('dataset.merge(user, name, records) works as expected', async function () {
    await dataset.merge(user, name, {
      'test-2': 1,
      'test-3': Buffer.from('looks good?')
    })
    const meta = await dataset.readMeta(user, name)
    assert.equal(meta.version, 2)
    assert.hasAllKeys(meta.records, ['test-1', 'test-2', 'test-3'])
    assert.equal(await dataset.read(user, name, 'test-2'), 1)
    assert.isTrue(Buffer.isBuffer(await dataset.read(user, name, 'test-3')))
  })

  it('dataset.list(user, name) works', async function () {
    const list = await dataset.list(user, name)
    assert.deepStrictEqual(list.map(x => x.id).sort(), ['test-1', 'test-2', 'test-3'].sort(), 'list should list out the right objects')
    const test3 = list.find(x => x.id === 'test-3')
    assert.equal(test3.version, 2, 'version number should be correct')
    assert.isTrue(Buffer.isBuffer(test3.hash), 'hash is a Buffer')
    assert.equal(test3.hash.length, 32, 'hash length must be correct for sha256')
    const read = await test3.read()
    assert.isTrue(Buffer.isBuffer(read))
    assert.isTrue(read.equals(Buffer.from('looks good?')))
  })

  it('dataset.overwrite(user, name, records) works as expected', async function () {
    await dataset.overwrite(user, name, { abc: 123, def: 456 })
    const meta = await dataset.readMeta(user, name)
    assert.equal(meta.version, 3)
    assert.hasAllKeys(meta.records, ['abc', 'def'])
    assert.equal(await dataset.read(user, name, 'abc'), 123)
    assert.equal(await dataset.read(user, name, 'def'), 456)
  })

  it('dataset.write() with same value doesn\'t change version number', async function () {
    await dataset.write(user, name, 'def', 456)
    const meta = await dataset.readMeta(user, name)
    assert.equal(meta.version, 4)
    assert.equal(meta.records.abc.version, 3)
    assert.equal(meta.records.def.version, 3)
  })

  it('dataset.exists() works correctly', async function () {
    assert.isTrue(await dataset.exists(user, name))
    assert.isTrue(await dataset.exists(user, name, 'abc'))
    assert.isTrue(await dataset.exists(user, name, 'def'))
    assert.isFalse(await dataset.exists(user, name, 'xyz'))
    assert.isFalse(await dataset.exists(user, name, 'test-1'))
    assert.isFalse(await dataset.exists(user, 'fake-dataset-doesnt-exist'))
    assert.isFalse(await dataset.exists(user, 'fake-dataset-doesnt-exist', 'non-existing-record'))
  })

  it('dataset.delete(user, name, record) works', async function () {
    await dataset.delete(user, name, 'def')
    const meta = await dataset.readMeta(user, name)
    assert.hasAllKeys(meta.records, ['abc'])
    assert.equal(meta.version, 5)
  })

  it('dataset.delete(user, name) works', async function () {
    assert.isTrue(await dataset.exists(user, name))
    assert.isTrue(await dataset.exists(user, name, 'abc'))
    await dataset.delete(user, name)
    assert.isFalse(await dataset.exists(user, name))
    assert.isFalse(await dataset.exists(user, name, 'abc'))
  })
})
