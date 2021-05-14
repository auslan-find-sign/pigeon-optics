const fs = require('fs')
const workerBase = require('./lens-worker-base')
const ivm = require('isolated-vm')
const settings = require('../models/settings')
const timestring = require('timestring')
const codec = require('../models/codec')

const StackTracey = require('stacktracey')

Object.assign(exports, workerBase)

let isolate // ivm isolate
let context // ivm context
let code // keep a copy of the lens author source code for generating good errors
let mapFnReference // reference to lens author defined map function inside of the context
let reduceFnReference // reference to lens author defined reduce function inside of the context
let timeout
let outputs
let logs

//
/**
 * take an error from a map or reduce function compile or run, and transform it to be cleaned up
 * @param {Error} error
 * @param {string} file
 * @param {string} source
 * @returns
 */
function transformVMError (error, file, source) {
  const trace = new StackTracey(error)
  const sourceLines = `${source}`.split(/\r?\n/gm)
  // filter the stacktrace to just entries referencing lens author code, not anything around it (vm env code)
  const filteredTrace = trace.filter(x => x.file === file && x.line >= 1 && x.line <= sourceLines.length)
  const stack = filteredTrace.items.map(x => ({
    line: x.line,
    column: x.column,
    filename: x.fileName,
    code: sourceLines[x.line - 1]
  }))

  if (!error.stack || !error.stack.includes('at (<isolated-vm boundary>)')) {
    // probably the error actually happened in this file, not in user code, so log it:
    console.error(error)
  }

  return {
    type: error.constructor.name,
    message: error.message,
    stack
  }
}

// compile all the scripts, set everything up, ready to blast through the data
exports.startup = async function (config) {
  const returnVal = { map: { errors: [] }, reduce: { errors: [] } }
  // Setup a VM for executing javascript lenses
  isolate = new ivm.Isolate({ memoryLimit: 256 })
  // Precompile the codec-lite.ivm init code
  context = await isolate.createContext()

  // make 'global' ref to global available
  // TODO: consider removing this before lens code runs? or freezing it?
  await context.global.set('global', context.global.derefInto())
  // load the codec library
  const environmentIvmCode = await fs.promises.readFile(require.resolve('./environment.js/bundle.min.js'))
  await context.eval(environmentIvmCode.toString('utf-8'))

  // setup safe logger console object
  const logger = ({ type, args, stack }) => {
    const trace = new StackTracey(stack)
    const source = trace.items.find(x => (x.file === 'map.js' || x.file === 'reduce.js') && x.line >= 1)
    const logEntry = { type, args, line: source ? source.line : undefined }
    logs.push(logEntry)
  }

  // setup safe output function
  const output = (id, data) => outputs.push({ id, data: data })

  // api made available to the vm
  function ioFunction (cmd, ...args) {
    if (cmd === 'log') {
      logger(...args)
    } else if (cmd === 'output') {
      output(...args)
    }
  }

  const ioFunctionRef = new ivm.Reference(ioFunction)

  context.evalClosure(`
  // make console api available globally
  $0.console = Object.freeze(Object.fromEntries('log info warn error'.split(' ').map(type =>
    [type, (...args) => $1.applyIgnored(undefined, ['log', { type, args, stack: (new Error('trace')).stack.toString() }], { arguments: { copy: true } })]
  )))
  // make output function available globally
  $0.output = (id, data) => { $1.applySync(undefined, ['output', id, data], { arguments: { copy: true } }) }
  `, [context.global.derefInto(), ioFunctionRef], { filename: 'pigeon-optics-lens-api.js' })

  // keep the code around for debugging
  code = { map: config.mapCode, reduce: config.reduceCode }

  // build precompiled map function
  try {
    const snippet = `return function map (path, data) {\n${code.map}\n}`
    const opts = {
      timeout,
      lineOffset: -1,
      columnOffset: -6,
      filename: 'map.js',
      result: { reference: true }
    }
    mapFnReference = (await context.evalClosure(snippet, [], opts)).result
  } catch (err) {
    returnVal.map.errors.push(transformVMError(err, 'map.js', code.map))
  }

  try {
    const snippet = `return function reduce (left, right) {\n${code.reduce}\n}`
    const opts = {
      timeout,
      lineOffset: -1,
      filename: 'reduce.js',
      result: { reference: true }
    }
    reduceFnReference = (await context.evalClosure(snippet, [], opts)).result
  } catch (err) {
    returnVal.reduce.errors.push(transformVMError(err, 'reduce.js', code.reduce))
  }

  // parse current configured timeout
  timeout = timestring(settings.lensTimeout, 'ms')

  return returnVal
}

exports.map = async function (input) {
  logs = []
  outputs = []

  try {
    const path = {
      string: input.path,
      ...codec.path.decode(input.path)
    }
    const data = input.data

    await mapFnReference.apply(undefined, [path, data], {
      timeout,
      arguments: { copy: true }
    })

    return { logs, errors: [], outputs }
  } catch (err) {
    return {
      logs,
      errors: [transformVMError(err, 'map.js', code.map)],
      outputs
    }
  }
}

exports.reduce = async function (left, right) {
  logs = []
  outputs = []

  try {
    const result = await reduceFnReference.apply(undefined, [left, right], {
      timeout,
      arguments: { copy: true },
      result: { copy: true }
    })

    return { logs, errors: [], value: result }
  } catch (err) {
    return {
      logs,
      errors: [transformVMError(err, 'reduce.js', code.reduce)],
      value: undefined
    }
  }
}

// destroy the VM
exports.shutdown = async function () {
  logs = []
  outputs = []
  if (mapFnReference) mapFnReference.release()
  if (reduceFnReference) reduceFnReference.release()
  if (context) context.release()
  if (isolate) isolate.dispose()
}
