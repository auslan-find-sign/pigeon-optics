const childProcess = require('child_process')

exports.LensWorker = class LensWorker {
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
    return await this._rpc('startup', config)
  }

  async _rpc (command, ...args) {
    this.seq += 1
    const promise = new Promise((resolve, reject) => {
      this.promises[this.seq] = { resolve, reject }
    })
    this.worker.send({ seq: this.seq, command, args })
    return await promise
  }

  async map (input) {
    return this._rpc('map', input)
  }

  async reduce (left, right) {
    return this._rpc('reduce', left, right)
  }

  async shutdown () {
    await this._rpc('shutdown')
    if (this.worker.connected) this.worker.kill()
  }
}
