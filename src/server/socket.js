import SocketIO from 'socket.io'
import Delogger from 'delogger'

import Config from '../utils/config'

const config = new Config({sync: true})
const log = new Delogger('Socket')

function authorization (socket, next) {
  if (socket.handshake.query.secret === config.secret) {
    return next()
  }

  return next(new Error('Invalid authentication secret'))
}

module.exports = (server) => {
  server.io = SocketIO(server.server)

  server.io.use(authorization)

  log.info('Waiting servers to connect')
  server.io.on('connection', (client) => {
    log.info('Client connect')
    server.clients++
    client.on('disconnect', () => {
      log.info('Client disconnect')
      server.clients--
    })
  })
}
