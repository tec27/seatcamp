import express from 'express'
import http from 'http'
import thenify from 'thenify'
import socketIo from 'socket.io'
import webpack from 'webpack'
import compression from 'compression'
import serveStatic from 'serve-static'
import serveCss from './lib/serve-css'
import userCounter from './lib/user-counter'
import createFfmpegRunner from './lib/ffmpeg-runner'
import ChatSockets from './lib/chat-sockets'

import webpackConfig from './webpack.config'

const userIdKey = process.env.SEATCAMP_ID_KEY
if (!userIdKey) {
  throw new Error('SEATCAMP_ID_KEY must be specified!')
}

const app = express()
app.set('x-powered-by', false).set('view engine', 'pug')

const httpServer = http.Server(app)
const listenPort = process.env.SEATCAMP_PORT ?? 3456
const listenHost = process.env.SEATCAMP_HOST
const canonicalHost = process.env.SEATCAMP_CANONICAL_HOST

const io = socketIo(httpServer)

if (process.env.SEATCAMP_TRUST_PROXY === '1') {
  app.set('trust proxy', true)
}

app.use(require('cookie-parser')())

if (canonicalHost) {
  const asUrl = new URL(canonicalHost)
  const toCompare = asUrl.host.toLowerCase()

  app.use((req, res, next) => {
    const host = req.hostname.toLowerCase()
    if (host !== toCompare) {
      res.redirect(308, `${canonicalHost}${req.url}`)
    } else {
      next()
    }
  })
}

const compiler = webpack(webpackConfig)
if (process.env.NODE_ENV !== 'production') {
  const webpackDevMiddleware = require('webpack-dev-middleware')
  app.use(
    webpackDevMiddleware(compiler, {
      publicPath: webpackConfig.output.publicPath,
    }),
  )
} else {
  compiler.run = thenify(compiler.run)
}

app.use(compression())
app
  .get('/', (req, res) =>
    res.render('index', { theme: req.cookies.theme, trackingId: process.env.SEATCAMP_GA_ID }),
  )
  .get('/styles.css', serveCss(__dirname + '/css/styles.css'))

app.use(serveStatic('public'))

const compilePromise = process.env.NODE_ENV !== 'production' ? Promise.resolve() : compiler.run()
if (process.env.NODE_ENV === 'production') {
  console.log('In production mode, building assets...')
}

const readyPromise = compilePromise.then(async stats => {
  if (stats) {
    if ((stats.errors && stats.errors.length) || (stats.warnings && stats.warnings.length)) {
      throw new Error(stats.toString())
    }

    const statStr = stats.toString({ colors: true })
    console.log(`Webpack stats:\n${statStr}`)
  }

  userCounter(io)
  const runner = await createFfmpegRunner()

  const chat = new ChatSockets( // eslint-disable-line no-unused-vars
    app,
    io,
    userIdKey,
    runner,
    15 /* server backscroll limit */,
    10 * 60 * 1000 /* expiry time */,
    1.2548346 /* expiry gain factor, calculated so last message =~ 6 hours */,
  )

  await new Promise(resolve => httpServer.listen(listenPort, listenHost, resolve))
  const host = httpServer.address().address
  const port = httpServer.address().port
  console.log('Listening at http://%s:%s', host, port)
})

export default {
  io,
  httpServer,
  readyPromise,
}
