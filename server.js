import express from 'express'
import http from 'http'
import https from 'https'
import path from 'path'
import fs from 'fs'
import socketIo from 'socket.io'
import browserify from 'browserify-middleware'
import bundleCollapser from 'bundle-collapser/plugin'
import serveStatic from 'serve-static'
import serveCss from './lib/serve-css'
import canonicalHost from 'canonical-host'
import userCounter from './lib/user-counter'
import createFfmpegRunner from './lib/ffmpeg-runner'
import ChatSockets from './lib/chat-sockets'
import config from './conf.json'

const userIdKey = config.idKey
if (!userIdKey) {
  throw new Error('idKey must be specified in conf.json!')
}

const app = express()
app
  .set('x-powered-by', false)
  .set('view engine', 'jade')

const servers = []
let httpServer
let listenPort

if (config.sslCert) {
  if (!config.sslKey || !config.sslCaBundle || !config.canonicalHost || !config.sslPort) {
    throw new Error('sslCert, sslKey, sslCaBundle, sslPort, and canonicalHost must all be ' +
        'configured for SSL support.')
  }

  const caList = []
  const curCert = []
  const caFile = fs.readFileSync(path.join(__dirname, config.sslCaBundle), 'utf8')
  for (const line of caFile.split('\n')) {
    if (!line.length) continue

    curCert.push(line)
    if (line.match(/-END CERTIFICATE-/)) {
      caList.push(curCert.join('\n'))
      curCert.length = 0
    }
  }
  curCert.length = 0

  const sslCert = fs.readFileSync(path.join(__dirname, config.sslCert), 'utf8')
  const sslKey = fs.readFileSync(path.join(__dirname, config.sslKey), 'utf8')

  httpServer = https.createServer({
    ca: caList,
    cert: sslCert,
    key: sslKey
  }, app)
  listenPort = config.sslPort

  const canon = canonicalHost(config.canonicalHost, 301)
  const redirector = http.createServer(function(req, res) {
    if (canon(req, res)) return
    res.statusCode = 400
    res.end('Bad request\n')
  })
  servers.push(redirector)

  redirector.listen(config.port)
} else {
  httpServer = http.Server(app)
  listenPort = config.port
}
servers.push(httpServer)

const io = socketIo(httpServer)

app.use(require('cookie-parser')())

const browserifyOpts = {}
if (process.env.NODE_ENV === 'production') {
  browserifyOpts.plugins = [{ plugin: bundleCollapser }]
}

app
  .get('/', (req, res) =>
    res.render('index', { theme: req.cookies.theme, trackingId: config.gaTrackingId }))
  .get('/client.js', browserify(__dirname + '/client/index.js', browserifyOpts))
  .get('/styles.css', serveCss(__dirname + '/css/styles.css'))

app.use(serveStatic('public'))

const readyPromise = new Promise((resolve, reject) => {
  userCounter(io)
  createFfmpegRunner((err, runner) => {
    if (err) {
      throw err
    }

    const chat = new ChatSockets(// eslint-disable-line no-unused-vars
      io,
      userIdKey,
      runner,
      15, /* server backscroll limit */
      10 * 60 * 1000, /* expiry time */
      1.2548346 /* expiry gain factor, calculated so last message =~ 6 hours */,
      !!config.imageMagick7)

    httpServer.listen(listenPort, function() {
      const host = httpServer.address().address
      const port = httpServer.address().port
      console.log('Listening at http%s://%s:%s', config.sslCert ? 's' : '', host, port)
      resolve()
    })
  })
})

export default {
  io,
  servers,
  readyPromise,
}
