/* eslint-disable no-unused-expressions */
const { LensWorker } = require('../library/workers/interface')
const chai = require('chai')
chai.use(require('chai-as-promised'))
const { expect } = chai
const codec = require('../library/models/codec')

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

describe('workers/interface.LensWorker#startup', async function () {
  it('catches map syntax errors', async function () {
    const worker = new LensWorker()
    const startup = await worker.startup({
      mapType: 'javascript',
      mapCode: mapCode + '\nyield 5',
      reduceCode
    })

    await worker.shutdown()

    expect(startup.map.errors).to.not.be.empty
  })

  it('catches reduce syntax errors', async function () {
    const worker = new LensWorker()
    const startup = await worker.startup({
      mapType: 'javascript',
      mapCode,
      reduceCode: reduceCode + '\nyield 5'
    })

    await worker.shutdown()

    expect(startup.reduce.errors).to.not.be.empty
  })

  it('catches map and reduce syntax errors in the same run', async function () {
    const worker = new LensWorker()
    const startup = await worker.startup({
      mapType: 'javascript',
      mapCode: mapCode + '\nyield 5',
      reduceCode: reduceCode + '\nyield 5'
    })

    await worker.shutdown()

    expect(startup.map.errors).to.not.be.empty
    expect(startup.reduce.errors).to.not.be.empty
  })

  it('starts up correctly with good code', async function () {
    const worker = new LensWorker()
    const startup = await worker.startup({
      mapType: 'javascript',
      mapCode: mapCode,
      reduceCode: reduceCode
    })

    await worker.shutdown()

    expect(startup.map.errors).to.be.an('array').and.be.empty
    expect(startup.reduce.errors).to.be.an('array').and.be.empty
  })
})

describe('workers/interface.LensWorker#map', async function () {
  let worker

  before('startup worker', async function () {
    worker = new LensWorker()
    await worker.startup({
      mapType: 'javascript',
      mapCode: mapCode,
      reduceCode: reduceCode
    })
  })

  it('maps correctly', async function () {
    const result = await worker.map({
      path: '/datasets/user:name/records/recordID',
      data: { foo: 'bar', v: 'yehaw' }
    })

    const expected = [
      { id: 'a', data: 1 },
      { id: 'b', data: 2 },
      { id: 'c', data: 'yehaw' },
      { id: 'c', data: 'yehaw' },
      { id: 'c', data: 'yehaw' }
    ]

    expect(result.outputs).to.deep.equal(expected)
    expect(result.logs).to.be.an('array').and.be.empty
    expect(result.errors).to.be.an('array').and.be.empty
  })

  it('logs from maps and catches throws', async function () {
    const result = await worker.map({
      path: '/datasets/user:name/records/recordID',
      data: { foo: 'bar', v: 'yehaw', plzthrow: 'nice', plzlog: 'hey' }
    })

    expect(result.logs).to.have.length(1)
    expect(result.logs[0].args).to.deep.equal(['hey'])
    expect(result.errors).to.have.length(1)
    expect(result.errors[0].message).to.equal('nice')
    expect(result.errors[0].type).to.equal('Error')
  })

  after('shutdown worker', async function () {
    await worker.shutdown()
  })
})

describe('workers/interface.LensWorker#reduce', async function () {
  let worker

  before('startup worker', async function () {
    worker = new LensWorker()
    await worker.startup({
      mapType: 'javascript',
      mapCode: mapCode,
      reduceCode: reduceCode
    })
  })

  it('reduces correctly', async function () {
    const result = await worker.reduce(10, 20)

    expect(result.value).to.equal(30)
    expect(result.logs).to.be.an('array').and.be.empty
    expect(result.errors).to.be.an('array').and.be.empty
  })

  it('reduces captures log messages', async function () {
    const result = await worker.reduce('log', 'foo')

    expect(result.value).to.equal('logfoo')
    expect(result.logs).to.have.length(1)
    expect(result.logs[0].args).to.deep.equal(['hey', 'whats up', 5])
    expect(result.errors).to.be.an('array').and.be.empty
  })

  it('reduces captures thrown errors', async function () {
    const result = await worker.reduce('we gonna ', 'error')

    expect(result.value).to.be.undefined
    expect(result.logs).to.be.an('array').and.be.empty
    expect(result.errors).to.be.an('array').and.have.length(1)
    expect(result.errors[0].message).to.equal('oops')
    expect(result.errors[0].type).to.equal('Error')
  })

  it('reduces preserves logs when it catches thrown errors', async function () {
    const result = await worker.reduce('log', 'error')

    expect(result.value).is.undefined
    expect(result.logs).is.an('array').and.has.length(1)
    expect(result.errors).is.an('array').and.has.length(1)
  })

  after('shutdown worker', async function () {
    await worker.shutdown()
  })
})

// testing the worker environment code is working inside the worker, more extensive tests in ./test-workers-javascript-environment.js
// doing tests across the process bridge is slow and irritating to debug when stuff breaks, so it happens in main thread in that suite
describe('workers/environment.js', () => {
  let worker
  before(async () => {
    worker = new LensWorker()
    // abuse reduce as a simple way of calling CSS.select in the virtual machine
    const startup = await worker.startup({
      mapType: 'javascript',
      mapCode: '// no thank you',
      reduceCode: 'return JsonML[left](...right)'
    })

    expect(startup.map.errors).is.an('array').and.is.empty
    expect(startup.reduce.errors).is.an('array').and.is.empty
  })

  it('ivm environment: JsonML.select()', async () => {
    const document = codec.xml.decode('<root><div id="yeah">no</div><span>cool</span></root>')
    const result = await worker.reduce('select', [document, '#yeah'])
    expect(result).to.deep.equal({ logs: [], errors: [], value: [['div', { id: 'yeah' }, 'no']] })
  })

  it('ivm environment: JsonML.text()', async () => {
    const document = { JsonML: ['root', {}, ['div', { id: 'yeah' }, 'no'], ['span', {}, 'cool']] }
    const res = await worker.reduce('text', [document])
    expect(res).to.deep.equal({ errors: [], logs: [], value: 'nocool' })
  })

  it('ivm environment: JsonML.attr()', async () => {
    const element = ['div', { id: 'yeah' }, 'no']
    const res = await worker.reduce('attr', [element, 'id'])
    expect(res).to.deep.equal({ errors: [], logs: [], value: 'yeah' })
  })

  it('ivm environment: JsonML.toHTML()', async () => {
    const document = { JsonML: ['root', {}, ['div', { id: 'yeah' }, 'no'], ['span', {}, 'cool']] }
    const expected = '<!DOCTYPE html>\n<root><div id=yeah>no</div><span>cool</span></root>'
    const res = await worker.reduce('toHTML', [document])
    expect(res).to.deep.equal({ errors: [], logs: [], value: expected })
  })

  it('ivm environment: JsonML.toXML()', async () => {
    const document = { JsonML: ['root', {}, ['div', { id: 'yeah' }, 'no'], ['span', {}, 'cool']] }
    const expected = '<root><div id="yeah">no</div><span>cool</span></root>'
    const res = await worker.reduce('toXML', [document])
    expect(res).to.deep.equal({ errors: [], logs: [], value: expected })
  })

  after(async () => {
    await worker.shutdown()
  })
})
