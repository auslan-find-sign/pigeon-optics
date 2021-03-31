const chai = require('chai')
chai.use(require('chai-as-promised'))
const assert = chai.assert
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
    assert.isTrue((await lens.readMeta(user, lensName)).memo.startsWith('Automated Unit Testing'), 'memo should be preserved in new dataset')
  })

  it('lens.build(user, name) works', async function () {
    await lens.build(user, lensName)
    const list = await lens.list(user, lensName)

    const data = {}
    for (const { id, read } of list) data[id] = await read()
    assert.deepStrictEqual(data, {
      cat: ['abc', 'ghi'].sort(),
      dog: ['abc', 'def', 'ghi'].sort(),
      mango: ['def']
    })
  })

  it('lens.build(user, name) transfers logs correctly', async function () {
    await dataset.write(user, datasetName, 'def', { tags: ['dog', 'mango'], log: 'log test' })
    await dataset.write(user, datasetName, 'ghi', { tags: ['dog', 'cat'], error: 'error test' })
    await lens.build(user, lensName)

    const logs = {}
    for await (const log of lens.iterateLogs(user, lensName)) logs[codec.path.decode(log.input).recordID] = log

    assert.strictEqual(logs.abc.logs.length, 0, 'abc shouldn\'t have logged anything')
    assert.strictEqual(logs.abc.errors.length, 0, 'abc shouldn\'t have errored anything')
    assert.strictEqual(logs.def.logs.length, 1, 'def should have logged one thing')
    assert.strictEqual(logs.def.errors.length, 0, 'def shouldn\'t have errored')
    assert.strictEqual(logs.ghi.logs.length, 0, 'ghi shouldn\'t have logged')
    assert.strictEqual(logs.ghi.errors.length, 1, 'ghi should have errored')
    assert.strictEqual(logs.def.logs[0].type, 'log', 'log type should be "log"')
    assert.deepStrictEqual(logs.def.logs[0].args, ['log test'])
    assert.strictEqual(logs.ghi.errors[0].type, 'Error', 'error.type should === "Error"')
    assert.strictEqual(logs.ghi.errors[0].message, 'error test', 'error.message should be "error test" exactly')
  })

  it('lens.delete(user, name) works', async function () {
    assert.isTrue(await lens.exists(user, lensName))
    assert.isTrue(await lens.exists(user, lensName, 'cat'))
    await lens.delete(user, lensName)
    assert.isFalse(await lens.exists(user, lensName))
    assert.isFalse(await lens.exists(user, lensName, 'cat'))
    await dataset.delete(user, datasetName)
  })
})
