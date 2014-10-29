var express = require('express')
  , http = require('http')
  , socketIo = require('socket.io')
  , browserify = require('browserify-middleware')
  , serveStatic = require('serve-static')
  , userCounter = require('./lib/user-counter')
  , chatSockets = require('./lib/chat-sockets')
  , meatspaceProxy = require('./lib/meatspace-proxy')
  , config = require('./conf.json')

var userIdKey = config.idKey
if (!userIdKey) {
  throw new Error('idKey must be specified in conf.json!')
}

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
chatSockets(
    io,
    userIdKey,
    meatspaceProxy(config.meatspaceServer),
    15 /* server backscroll limit */,
    10 * 60 * 1000 /* expiry time */)

httpServer.listen(config.port, function() {
  var host = httpServer.address().address
    , port = httpServer.address().port
  console.log('Listening at http://%s:%s', host, port)
})
