import express from 'express'
import http from 'http'
import thenify from 'thenify'
import socketIo from 'socket.io'
import webpackDevMiddleware from 'webpack-dev-middleware'
import webpack from 'webpack'
import compression from 'compression'
import serveStatic from 'serve-static'
import serveCss from './lib/serve-css'
import userCounter from './lib/user-counter'
import createFfmpegRunner from './lib/ffmpeg-runner'
import ChatSockets from './lib/chat-sockets'

import webpackConfig from './webpack.config'
import config from './conf.json'

const userIdKey = config.idKey
if (!userIdKey) {
  throw new Error('idKey must be specified in conf.json!')
}

const app = express()
app.set('x-powered-by', false).set('view engine', 'pug')

const httpServer = http.Server(app)
const listenPort = config.port

const io = socketIo(httpServer)

app.use(require('cookie-parser')())

const compiler = webpack(webpackConfig)
if (process.env.NODE_ENV !== 'production') {
  app.use(
    webpackDevMiddleware(compiler, {
      publicPath: webpackConfig.output.publicPath,
      lazy: !!process.env.TESTING_NO_COMPILE,
    }),
  )
} else {
  compiler.run = thenify(compiler.run)
}

app.use(compression())
app
  .get('/', (req, res) =>
    res.render('index', { theme: req.cookies.theme, trackingId: config.gaTrackingId }),
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

  await new Promise(resolve => httpServer.listen(listenPort, resolve))
  const host = httpServer.address().address
  const port = httpServer.address().port
  console.log('Listening at http%s://%s:%s', config.sslCert ? 's' : '', host, port)
})

export default {
  io,
  httpServer,
  readyPromise,
}
