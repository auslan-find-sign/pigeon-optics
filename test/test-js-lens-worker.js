const { LensWorker } = require('../library/workers/interface')
const assert = require('assert')

const mapCode = `// this is my test map code
// it should output five things, a, b, and c c c
output('a', 1)
output('b', 2)
output('c', data.v)
output('c', data.v)
output('c', data.v)
if (data.plzlog) console.log(data.plzlog)
if (data.plzthrow) throw new Error(data.plzthrow)`

const reduceCode = `// this is my test reduce code, given left and right, it should add them
if (left === 'log') console.log('hey', 'whats up', 5)
if (right === 'error') throw new Error('oops')
return left + right`

describe('/library/workers/interface.js > LensWorker.startup', async () => {
  it('catches map syntax errors', async () => {
    const worker = new LensWorker()
    const startup = await worker.startup({
      mapType: 'javascript',
      mapCode: mapCode + '\nyield 5',
      reduceCode
    })

    await worker.shutdown()

    assert(startup.map.errors.length > 0, 'startup should return at least one error about the map code syntax')
  })

  it('catches reduce syntax errors', async () => {
    const worker = new LensWorker()
    const startup = await worker.startup({
      mapType: 'javascript',
      mapCode,
      reduceCode: reduceCode + '\nyield 5'
    })

    await worker.shutdown()

    assert(startup.reduce.errors.length > 0, 'startup should return at least one error about the map code syntax')
  })

  it('catches map and reduce syntax errors in the same run', async () => {
    const worker = new LensWorker()
    const startup = await worker.startup({
      mapType: 'javascript',
      mapCode: mapCode + '\nyield 5',
      reduceCode: reduceCode + '\nyield 5'
    })

    await worker.shutdown()

    assert(startup.map.errors.length > 0, 'startup should return at least one error about the map code syntax')
    assert(startup.reduce.errors.length > 0, 'startup should return at least one error about the map code syntax')
  })

  it('starts up correctly with good code', async () => {
    const worker = new LensWorker()
    const startup = await worker.startup({
      mapType: 'javascript',
      mapCode: mapCode,
      reduceCode: reduceCode
    })

    await worker.shutdown()

    assert.strictEqual(startup.map.errors.length, 0, 'there should be no map code errors')
    assert.strictEqual(startup.reduce.errors.length, 0, 'there should be no reduce code errors')
  })
})

describe('/library/workers/interface.js > LensWorker.map', async () => {
  it('maps correctly', async () => {
    const worker = new LensWorker()
    await worker.startup({
      mapType: 'javascript',
      mapCode: mapCode,
      reduceCode: reduceCode
    })

    const result = await worker.map({
      path: '/datasets/user:name/records/recordID',
      data: { foo: 'bar', v: 'yehaw' }
    })

    await worker.shutdown()

    const expected = [
      { id: 'a', data: 1 },
      { id: 'b', data: 2 },
      { id: 'c', data: 'yehaw' },
      { id: 'c', data: 'yehaw' },
      { id: 'c', data: 'yehaw' }
    ]

    assert.deepStrictEqual(result.outputs, expected, 'outputs should be as expected')
    assert.deepStrictEqual(result.logs, [], 'there shouldn\'t be any log messages')
    assert.deepStrictEqual(result.errors, [], 'there shouldn\'t be any errors')
  })

  it('logs from maps and catches throws', async () => {
    const worker = new LensWorker()
    await worker.startup({
      mapType: 'javascript',
      mapCode: mapCode,
      reduceCode: reduceCode
    })

    const result = await worker.map({
      path: '/datasets/user:name/records/recordID',
      data: { foo: 'bar', v: 'yehaw', plzthrow: 'nice', plzlog: 'hey' }
    })

    await worker.shutdown()

    assert.deepStrictEqual(result.logs.length, 1, 'there should be one log output')
    assert.deepStrictEqual(result.logs[0].args, ['hey'], 'the log should have the right message')
    assert.deepStrictEqual(result.errors.length, 1, 'there should be one error thrown')
    assert.deepStrictEqual(result.errors[0].message, 'nice', 'error message should be correct')
    assert.deepStrictEqual(result.errors[0].type, 'Error', 'error message should be of the Error type')
  })
})

describe('/library/workers/interface.js > LensWorker.reduce', async () => {
  it('reduces correctly', async () => {
    const worker = new LensWorker()
    await worker.startup({
      mapType: 'javascript',
      mapCode: mapCode,
      reduceCode: reduceCode
    })

    const result = await worker.reduce(10, 20)

    await worker.shutdown()

    assert.deepStrictEqual(result.value, 30, 'value should be as expected')
    assert.deepStrictEqual(result.logs, [], 'there shouldn\'t be any log messages')
    assert.deepStrictEqual(result.errors, [], 'there shouldn\'t be any errors')
  })

  it('reduces captures log messages', async () => {
    const worker = new LensWorker()
    await worker.startup({
      mapType: 'javascript',
      mapCode: mapCode,
      reduceCode: reduceCode
    })

    const result = await worker.reduce('log', 'foo')

    await worker.shutdown()

    assert.deepStrictEqual(result.value, 'logfoo', 'value should be as expected')
    assert.deepStrictEqual(result.logs.length, 1, 'there should be one log message')
    assert.deepStrictEqual(result.logs[0].args, ['hey', 'whats up', 5], 'the message contents should be correct')
    assert.deepStrictEqual(result.errors, [], 'there shouldn\'t be any errors')
  })

  it('reduces captures thrown errors', async () => {
    const worker = new LensWorker()
    await worker.startup({
      mapType: 'javascript',
      mapCode: mapCode,
      reduceCode: reduceCode
    })

    const result = await worker.reduce('we gonna ', 'error')

    await worker.shutdown()

    assert.deepStrictEqual(result.value, undefined, 'value should be undefined')
    assert.deepStrictEqual(result.logs, [], 'there should be no logs')
    assert.deepStrictEqual(result.errors.length, 1, 'there should be an error')
    assert.deepStrictEqual(result.errors[0].message, 'oops', 'error message should be correct')
    assert.deepStrictEqual(result.errors[0].type, 'Error', 'error message should be of the Error type')
  })

  it('reduces preserves logs when it catches thrown errors', async () => {
    const worker = new LensWorker()
    await worker.startup({
      mapType: 'javascript',
      mapCode: mapCode,
      reduceCode: reduceCode
    })

    const result = await worker.reduce('log', 'error')

    await worker.shutdown()

    assert.deepStrictEqual(result.value, undefined, 'value should be undefined')
    assert.deepStrictEqual(result.logs.length, 1, 'there should be a log message')
    assert.deepStrictEqual(result.errors.length, 1, 'there should be an error')
  })
})
