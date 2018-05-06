const template = {
  database: {
    type: 'mongodb',
    host: '127.0.0.1',
    port: 27017,
    database: 'stellar-rocket-app',
    username: '',
    password: ''
  },
  server: {
    port: 3000,
    host: '0.0.0.0'
  },
  secret: 'some_secret',
  gameInterval: 5000,
  speed: 100,
  gameByRun: 100
}

module.exports = template

if (__filename.match(/.*template.*/g)) {
  console.log(JSON.stringify(template, 'undefined', 2))
}
