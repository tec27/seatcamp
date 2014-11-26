var express = require('express')
  , http = require('http')
  , https = require('https')
  , path = require('path')
  , fs = require('fs')
  , socketIo = require('socket.io')
  , browserify = require('browserify-middleware')
  , serveStatic = require('serve-static')
  , serveCss = require('./lib/serve-css')
  , canonicalHost = require('canonical-host')
  , userCounter = require('./lib/user-counter')
  , chatSockets = require('./lib/chat-sockets')
  , meatspaceProxy = require('./lib/meatspace-proxy')
  , config = require('./conf.json')

var userIdKey = config.idKey
if (!userIdKey) {
  throw new Error('idKey must be specified in conf.json!')
}

var app = express()
app
  .set('x-powered-by', false)
  .set('view engine', 'jade')

var httpServer
  , listenPort

if (config.sslCert) {
  if (!config.sslKey || !config.sslCaBundle || !config.canonicalHost || !config.sslPort) {
    throw new Error('sslCert, sslKey, sslCaBundle, sslPort, and canonicalHost must all be ' +
        'configured for SSL support.')
  }

  var caList = []
    , curCert = []
  var caFile = fs.readFileSync(path.join(__dirname, config.sslCaBundle), 'utf8')
  for (var line of caFile.split('\n')) {
    if (!line.length) continue

    curCert.push(line)
    if (line.match(/-END CERTIFICATE-/)) {
      caList.push(curCert.join('\n'))
      curCert.length = 0
    }
  }
  curCert.length = 0

  var sslCert = fs.readFileSync(path.join(__dirname, config.sslCert), 'utf8')
    , sslKey = fs.readFileSync(path.join(__dirname, config.sslKey), 'utf8')

  httpServer = https.createServer({
    ca: caList,
    cert: sslCert,
    key: sslKey
  }, app)
  listenPort = config.sslPort

  var canon = canonicalHost(config.canonicalHost, 301)
  http.createServer(function(req, res) {
    if (canon(req, res)) return
    res.statusCode = 400
    res.end('Bad request\n')
  }).listen(config.port)
} else {
  httpServer = http.Server(app)
  listenPort = config.port
}

var io = socketIo(httpServer)

app
  .get('/', (req, res) => res.render('index'))
  .get('/client.js', browserify('./client/index.js'))
  .get('/styles.css', serveCss('./css/styles.css'))

app.use(serveStatic('public'))

userCounter(io)
chatSockets(
    io,
    userIdKey,
    meatspaceProxy(config.meatspaceServer),
    15 /* server backscroll limit */,
    10 * 60 * 1000 /* expiry time */)

httpServer.listen(listenPort, function() {
  var host = httpServer.address().address
    , port = httpServer.address().port
  console.log('Listening at http%s://%s:%s', config.sslCert ? 's' : '', host, port)
})
