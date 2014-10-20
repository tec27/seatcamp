var io = require('socket.io-client')()

io.on('connect', function() {
  console.log('connected!')
})
