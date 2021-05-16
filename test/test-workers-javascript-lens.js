/* eslint-env mocha */
/* eslint-disable no-unused-expressions */
const { LensWorker } = require('../library/workers/interface')
const chai = require('chai')
chai.use(require('chai-as-promised'))
const { expect } = chai
const codec = require('../library/models/codec')

const testCode = `// this is my test map code
// it should output five things, a, b, and c c c
output('a', 1)
output('b', 2)
output('c', data.v)
output('c', data.v)
output('c', data.v)
if (data.plzlog) console.log(data.plzlog)
if (data.plzthrow) throw new Error(data.plzthrow)`

describe('workers/interface.LensWorker#startup', async function () {
  it('catches code syntax errors', async function () {
    const worker = new LensWorker()
    const startup = await worker.startup({
      mapType: 'javascript',
      code: testCode + '\nyield 5'
    })

    await worker.shutdown()

    expect(startup.errors).to.not.be.empty
  })

  it('starts up correctly with good code', async function () {
    const worker = new LensWorker()
    const startup = await worker.startup({
      mapType: 'javascript',
      code: testCode
    })

    await worker.shutdown()

    expect(startup.errors).to.be.an('array').and.be.empty
  })
})

describe('workers/interface.LensWorker#map', async function () {
  let worker

  before('startup worker', async function () {
    worker = new LensWorker()
    await worker.startup({
      mapType: 'javascript',
      code: testCode
    })
  })

  it('maps correctly', async function () {
    const result = await worker.map({
      path: '/datasets/author:name/records/recordID',
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
      path: '/datasets/author:name/records/recordID',
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

// testing the worker environment code is working inside the worker, more extensive tests in ./test-workers-javascript-environment.js
// doing tests across the process bridge is slow and irritating to debug when stuff breaks, so it happens in main thread in that suite
describe('workers/environment.js', () => {
  /** @type {LensWorker} */
  let worker
  before(async () => {
    worker = new LensWorker()
    // abuse reduce as a simple way of calling CSS.select in the virtual machine
    const startup = await worker.startup({
      mapType: 'javascript',
      code: `// rpc receiver code to reach inside the js vm and poke at it's internal APIs from the outside
        const segments = path.recordID.split('.')
        output('result', segments.reduce((a, b) => a[b], global)(...data))
      `
    })

    expect(startup.errors).is.an('array').and.is.empty
  })

  // RPC in to the worker via the map interface
  async function rpc (cmdPath, ...args) {
    const path = codec.path.encode('datasets', 'test', 'test', cmdPath)
    const result = await worker.map({ path, data: args })
    for (const { type, args } of result.logs) console[type](...args)
    if (result.errors.length > 0) throw new Error(JSON.stringify(result.errors[0]))
    const resultOutput = result.outputs.find(x => x.id === 'result')
    if (resultOutput) return resultOutput.data
  }

  it('ivm environment: Markup.select()', async () => {
    const document = codec.xml.decode('<root><div id="yeah">no</div><span>cool</span></root>')
    const result = await rpc('Markup.select', document, '#yeah')
    expect(result).to.deep.equal([['div', { id: 'yeah' }, 'no']])
  })

  it('ivm environment: Markup.get.text()', async () => {
    const document = ['root', {}, ['div', { id: 'yeah' }, 'no'], ['span', {}, 'cool']]
    const res = await rpc('Markup.get.text', document)
    expect(res).to.equal('nocool')
  })

  it('ivm environment: Markup.get.attribute()', async () => {
    const element = ['div', { id: 'yeah' }, 'no']
    const res = await rpc('Markup.get.attribute', element, 'id')
    expect(res).to.equal('yeah')
  })

  it('ivm environment: Markup.toHTML()', async () => {
    const document = ['#document', { doctype: 'html' }, ['html', ['div', { id: 'yeah' }, 'no'], ['span', 'cool']]]
    const expected = '<!DOCTYPE html>\n<html><div id=yeah>no</div><span>cool</span></html>'
    const res = await rpc('Markup.toHTML', document)
    expect(res).to.equal(expected)
  })

  it('ivm environment: Markup.toXML()', async () => {
    const document = ['root', ['div', { id: 'yeah' }, 'no'], ['span', 'cool']]
    const expected = '<root><div id="yeah">no</div><span>cool</span></root>'
    const res = await rpc('Markup.toXML', document)
    expect(res).to.equal(expected)
  })

  after(async () => {
    await worker.shutdown()
  })
})
