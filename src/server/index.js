import Delogger from 'delogger'
import http from 'http'

import Crash from '../utils/crash'
import Config from '../utils/config'

const config = new Config({sync: true})

export default class Server {
  constructor () {
    this.log = new Delogger('Server')
    this.server = http.createServer()

    require('./socket')(this)

    this.crash = new Crash(this.io)
    this.clients = 0
  }

  init () {
    return new Promise((resolve, reject) => {
      this.crash.init().then(resolve).catch((err) => {
        this.log.error('Failed to init Server')
        reject(err)
      })
    })
  }

  listen () {
    let port = config.server.port
    let host = config.server.host
    this.server.listen(port, host, (err) => {
      if (err) {
        this.log.error(err)
        throw err
      }

      this.log.info(`Server listening on port ${host}:${port}`)
    })

    this.startGame()
  }

  startGame () {
    if (this.clients > 0) {
      this.crash.start().then(this.waitAndRestartGame.bind(this))
    } else {
      this.waitAndRestartGame()
    }
  }

  waitAndRestartGame () {
    setTimeout(() => {
      this.startGame()
    }, config.gameInterval)
  }
}
