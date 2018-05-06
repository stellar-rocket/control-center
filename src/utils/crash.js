import Delogger from 'delogger'
import Crypto from 'crypto-js'

import CurrentRun from '../model/currentRun'
import Hash from '../model/hash'
import Config from '../utils/config'

const config = new Config({sync: true})
export default class Crash {
  constructor (ioSocket) {
    this.log = new Delogger('Crash')
    this.ioSocket = ioSocket

    this.currentRun = null
  }

  init () {
    return new Promise((resolve, reject) => {
      CurrentRun.findLatestOrCreate().then((currentRun) => {
        this.currentRun = currentRun

        if (!currentRun.position || currentRun.position < 0) {
          return currentRun.generateHashChain()
        }

        resolve()
      }).then(resolve).catch((err) => {
        this.log.error('Failed to init Crash')
        reject(err)
      })
    })
  }

  hmac (key, v) {
    var hmacHasher = Crypto.algo.HMAC.create(Crypto.algo.SHA256, key)
    return hmacHasher.finalize(v).toString()
  }

  calculateCrashPoint (seed) {
    var hash = this.hmac(seed, '000000000000000007a9a31ff7f07463d91af6b5454241d5faf282e5e0fe1b3a')
    // In 4 of 100 games the game crashes instantly.
    if (this.divisible(hash, 20)) {
      return 100
    }

    // Use the most significant 52-bit from the hash to calculate the crash point
    var h = parseInt(hash.slice(0, 52 / 4), 16)
    var e = Math.pow(2, 52)

    return Math.floor(((e - h / 50) / (e - h)) * 100)
  }

  divisible (hash, mod) {
    // So ABCDEFGHIJ should be chunked like  AB CDEF GHIJ
    // Considere le hash comme un grand nombre hexadecimal
    // Calcule si ce grand nombre est divisible par mod
    // decoupe le hash quatre par quatre et calcule si c'est modulo
    var val = 0

    var o = hash.length % 4
    for (let i = o > 0 ? o - 4 : 0; i < hash.length; i += 4) {
      val = ((val << 16) + parseInt(hash.substring(i, i + 4), 16)) % mod
    }
    return val === 0
  }

  start () {
    return new Promise((resolve, reject) => {
      this.log.info(`Starting game n°${this.currentRun.position} of run n°${this.currentRun.runId}`)

      this.currentRun.update({
        $inc: {
          position: -1
        }
      }).then(() => {
        return Hash.findOne(this.currentRun.chain[this.currentRun.position - 1])
      }).then((hash) => {
        let currentMult = 0
        let increase = 1

        const crashPoint = this.calculateCrashPoint(hash.value)
        const beginAt = new Date()
        this.ioSocket.emit('crash:begin', {
          metadata: {
            runId: this.currentRun.runId,
            position: this.currentRun.position
          }
        })

        let interval = setInterval(() => {
          this.send(Math.floor(currentMult))
          currentMult += increase
          if (currentMult > 100) {
            increase = increase * 1.01
          }

          if (currentMult >= crashPoint) {
            let duration = (new Date()) - beginAt
            clearInterval(interval)
            return this.end(hash.value, crashPoint, duration).then(resolve)
          }
        }, config.speed)
      })
    })
  }

  send (multiplicator) {
    this.ioSocket.emit('crash:value', {
      metadata: {
        runId: this.currentRun.runId,
        position: this.currentRun.position
      },
      multiplicator
    })
  }

  end (hash, crashPoint, duration) {
    return new Promise((resolve, reject) => {
      this.log.info(`Crashed at ${crashPoint / 100}`)
      this.log.info(`Duration: ${duration / 1000}s`)
      this.ioSocket.emit('crash:end', {
        metadata: {
          runId: this.currentRun.runId,
          position: this.currentRun.position
        },
        multiplicator: crashPoint,
        hash: hash
      })

      this.currentRun.position--
      if (this.currentRun.position <= 0) {
        return this.createNewRun().then(resolve)
      }

      resolve()
    })
  }

  createNewRun () {
    return new Promise((resolve, reject) => {
      CurrentRun.create({
        runId: this.currentRun.runId + 1
      }).then((doc) => {
        this.currentRun = doc
        return doc.generateHashChain()
      }).then(resolve).catch(reject)
    })
  }
}
