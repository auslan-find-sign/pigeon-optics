// this is a little worker server thing, which runs in a seperate node instance, and handles computing worker info

// defines command functions accessible over stdio interface
let worker
const api = {
  async startup (config) {
    if (config.mapType === 'javascript') {
      worker = require('./javascript-lens-worker')
    } else {
      throw new Error('Unsupported mapType')
    }
    return await worker.startup(config)
  },

  async map (input) {
    return await worker.map(input)
  },

  async reduce (left, right) {
    return await worker.reduce(left, right)
  },

  async shutdown () {
    await worker.shutdown()
    process.nextTick(x => process.exit())
  }
}

process.on('message', async ({ command, args, seq }) => {
  try {
    if (api[command]) {
      const result = await api[command](...args)
      process.send({ seq, result })
    } else {
      throw new Error('Unknown command')
    }
  } catch (err) {
    process.send({ seq, error: err })
  }
})
