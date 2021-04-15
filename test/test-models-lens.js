const chai = require('chai')
chai.use(require('chai-as-promised'))
const { expect } = chai
const codec = require('../library/models/codec')
const dataset = require('../library/models/dataset')
const lens = require('../library/models/lens')
const user = 'system'
const datasetName = 'test-dataset'
const lensName = 'test-lens'

describe('models/lens', function () {
  before(async function () {
    if (await dataset.exists(user, datasetName)) await dataset.delete(user, datasetName)
    if (await lens.exists(user, lensName)) await lens.delete(user, lensName)
    await dataset.create(user, datasetName, { memo: 'Test input data for testing lenses' })
    await dataset.overwrite(user, datasetName, {
      abc: { tags: ['cat', 'dog'] },
      def: { tags: ['dog', 'mango'] },
      ghi: { tags: ['dog', 'cat'] }
    })
  })

  it('lens.create(user, name) sets up a javascript lens', async function () {
    await lens.create(user, lensName, {
      memo: 'Automated Unit Testing created this lens to verify internal models are working correctly',
      mapType: 'javascript',
      mapCode: 'for (const tag of data.tags) output(tag, [path.recordID])\n' +
      'if (data.log) console.log(data.log)\n' +
      'if (data.error) throw new Error(data.error)\n',
      reduceCode: 'return [...left, ...right].sort()',
      inputs: [codec.path.encode('datasets', user, datasetName)]
    })
    await expect(lens.readMeta(user, lensName)).eventually.is.an('object').with.property('memo').that.includes('Automated Unit Testing')
  })

  it('lens.build(user, name) works', async function () {
    await lens.build(user, lensName)
    const list = await lens.list(user, lensName)

    const data = {}
    for (const { id, read } of list) data[id] = await read()
    expect(data).does.deep.equal({
      cat: ['abc', 'ghi'],
      dog: ['abc', 'def', 'ghi'],
      mango: ['def']
    })
  })

  it('lens.build(user, name) transfers logs correctly', async function () {
    await dataset.write(user, datasetName, 'def', { tags: ['dog', 'mango'], log: 'log test' })
    await dataset.write(user, datasetName, 'ghi', { tags: ['dog', 'cat'], error: 'error test' })
    await lens.build(user, lensName)

    const logs = {}
    for await (const log of lens.iterateLogs(user, lensName)) logs[codec.path.decode(log.input).recordID] = log

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

  it('lens.delete(user, name) works', async function () {
    await expect(lens.exists(user, lensName)).is.eventually.ok
    await expect(lens.exists(user, lensName, 'cat')).is.eventually.ok
    await lens.delete(user, lensName)
    await expect(lens.exists(user, lensName)).is.eventually.not.ok
    await expect(lens.exists(user, lensName, 'cat')).is.eventually.not.ok
    await dataset.delete(user, datasetName)
  })
})
