var express = require('express')
  , http = require('http')
  , socketIo = require('socket.io')
  , browserify = require('browserify-middleware')
  , serveStatic = require('serve-static')
  , userCounter = require('./lib/user-counter')
  , chatSockets = require('./lib/chat-sockets')

var app = express()
app.set('x-powered-by', false)
  .set('view engine', 'jade')

var httpServer = http.Server(app)
  , io = socketIo(httpServer)

app.get('/', function(req, res) {
  res.render('index')
}).get('/client.js', browserify('./client/index.js'))

app.use(serveStatic('public'))

userCounter(io)
chatSockets(io, 15 /* server backscroll limit */, 10 * 60 * 1000 /* expiry time */)
io.on('connection', function(socket) {
  console.log('socket connection!')
})

httpServer.listen(process.env.PORT || 3456, function() {
  var host = httpServer.address().address
    , port = httpServer.address().port
  console.log('Listening at http://%s:%s', host, port)
})
