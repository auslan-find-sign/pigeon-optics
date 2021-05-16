const chai = require('chai')
chai.use(require('chai-as-promised'))
const { expect } = chai
const codec = require('../library/models/codec')
const dataset = require('../library/models/dataset')
const lens = require('../library/models/lens')
const account = 'system'
const datasetName = 'test-dataset'
const lensName = 'test-lens'

describe('models/lens', function () {
  before(async function () {
    if (await dataset.exists(account, datasetName)) await dataset.delete(account, datasetName)
    if (await lens.exists(account, lensName)) await lens.delete(account, lensName)
    await dataset.create(account, datasetName, { memo: 'Test input data for testing lenses' })
    await dataset.overwrite(account, datasetName, {
      abc: { tags: ['cat', 'dog'] },
      def: { tags: ['dog', 'mango'] },
      ghi: { tags: ['dog', 'cat'] }
    })
  })

  after(async function () {
    await dataset.delete(account, datasetName)
  })

  it('lens.create(account, name) sets up a javascript lens', async function () {
    await lens.create(account, lensName, {
      memo: 'Automated Unit Testing created this lens to verify internal models are working correctly',
      mapType: 'javascript',
      code: 'for (const tag of data.tags) output(tag, new Set([path.recordID]))\n' +
      'if (data.log) console.log(data.log)\n' +
      'if (data.error) throw new Error(data.error)\n',
      inputs: [codec.path.encode('datasets', account, datasetName)]
    })
    await expect(lens.readMeta(account, lensName)).eventually.is.an('object').with.property('memo').that.includes('Automated Unit Testing')
  })

  it('lens.build(account, name) works', async function () {
    await lens.build(account, lensName)

    const records = {}
    for await (const { id, read } of lens.iterate(account, lensName)) {
      const data = await read()
      records[id] = [...data]
    }

    expect(records).to.deep.equal({
      cat: ['abc', 'ghi'],
      dog: ['abc', 'def', 'ghi'],
      mango: ['def']
    })
  })

  it('lens.build(account, name) transfers logs correctly', async function () {
    await dataset.write(account, datasetName, 'def', { tags: ['dog', 'mango'], log: 'log test' })
    await dataset.write(account, datasetName, 'ghi', { tags: ['dog', 'cat'], error: 'error test' })
    await lens.build(account, lensName)

    const logs = {}
    for await (const log of lens.iterateLogs(account, lensName)) logs[codec.path.decode(log.input).recordID] = log

    expect(logs.abc.logs).is.an('array').and.has.length(0)
    expect(logs.abc.errors).is.an('array').and.has.length(0)
    expect(logs.def.logs).is.an('array').and.has.length(1)
    expect(logs.def.errors).is.an('array').and.has.length(0)
    expect(logs.ghi.logs).is.an('array').and.has.length(0)
    expect(logs.ghi.errors).is.an('array').and.has.length(1)
    expect(logs.def.logs[0].type).does.equal('log')
    expect(logs.ghi.errors[0].type).does.equal('Error')
    expect(logs.ghi.errors[0].message).does.equal('error test')
    expect(logs.def.logs[0].args).is.an('array').and.deep.equals(['log test'])
  })

  it('lens.delete(account, name) works', async function () {
    await expect(lens.exists(account, lensName)).is.eventually.ok
    await expect(lens.exists(account, lensName, 'cat')).is.eventually.ok
    await lens.delete(account, lensName)
    await expect(lens.exists(account, lensName)).is.eventually.not.ok
    await expect(lens.exists(account, lensName, 'cat')).is.eventually.not.ok
  })
})
