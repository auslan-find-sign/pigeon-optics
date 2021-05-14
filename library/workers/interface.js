const childProcess = require('child_process')

class LensWorker {
  constructor () {
    this.started = false
  }

  /**
   * Startup a lens worker, with a given configuration. Eventually resolves when the worker has fully booted up (~50ms)
   * @param {object} config - lens configuration
   * @returns {{ errors: import('./lens-worker-base').LensError[] }}
   */
  async startup (config) {
    this.promises = {}
    this.seq = 0
    this.worker = childProcess.fork(require.resolve('./worker-server'), [], { serialization: 'advanced' })
    this.worker.on('message', ({ seq, error, result }) => {
      const { resolve, reject } = this.promises[seq]
      delete this.promises[seq]
      if (error) reject(error)
      else resolve(result)
    })
    this.worker.on('exit', () => {
      for (const { reject } of Object.values(this.promises)) reject(new Error('Disconnected'))
    })
    const res = await this._rpc('startup', config)
    this.started = true
    return res
  }

  /**
   * Interal: Call a worker method through the IPC RPC channel
   * @param {string} command - rpc command name
   * @param  {...any} args - rpc command arguments
   * @returns {any}
   */
  async _rpc (command, ...args) {
    this.seq += 1
    const promise = new Promise((resolve, reject) => {
      this.promises[this.seq] = { resolve, reject }
    })
    this.worker.send({ seq: this.seq, command, args })
    return await promise
  }

  /**
   * Run a user provided map function over a database document
   * @param {{ path: any, data: any }} input - input record to run through the map function
   * @returns {import('./lens-worker-base').MapOutput}
   */
  async map (input) {
    return this._rpc('map', input)
  }

  async reduce (left, right) {
    return this._rpc('reduce', left, right)
  }

  /**
   * Shutdown the lens worker, killing the subprocess, clearing memory.
   */
  async shutdown () {
    await this._rpc('shutdown')
    if (this.worker.connected) this.worker.kill()
  }
}

exports.LensWorker = LensWorker
