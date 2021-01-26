const file = require('../models/cbor-file')
const auth = require('../models/auth')
const BroadcastQueue = require('../utility/broadcast-queue')

class JavascriptLensWorker {
  /**
   * 
   * @param {BroadcastQueue} changeLog - broadcast queue that carries data changes
   */
  constructor (changeLog) {
    this.changeLog = changeLog
    this.changeStream = changeLog.getReadableStream()
  }

  
}

module.exports = JavascriptLensWorker
