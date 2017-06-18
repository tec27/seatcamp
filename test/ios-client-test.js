// Tests that the server is able to respond to an iOS client (that speaks the meatspac v2 protocol)
import proxyquire from 'proxyquire'
import spigot from 'stream-spigot'
import sio from 'socket.io-client'
import { expect } from 'chai'

process.env.TESTING_NO_COMPILE = true

const PORT = 62578
const testConfig = {
  port: PORT,
  idKey: 'test',
  '@noCallThru': true,
}

const stubFs = {
  createReadStream(path) {
    return spigot.array([ 'DEAD', 'BEEF' ])
  },
}

const stubChild = {
  exec(cmd, opts, cb) {
    if (cb) {
      cb()
    } else if (typeof opts === 'function') {
      opts()
    }
  },
}

const proxiedFrameConverter = proxyquire('../lib/frame-converter.js', {
  child_process: stubChild, // eslint-disable-line camelcase
  fs: stubFs,
})
const proxiedFfmpegRunner = proxyquire('../lib/ffmpeg-runner.js', {
  child_process: stubChild, // eslint-disable-line camelcase
})

const EMPTY_FRAME = 'data:image/jpeg;base64,'
const EMPTY_FRAMES = []
for (let i = 0; i < 10; i++) {
  EMPTY_FRAMES.push(EMPTY_FRAME)
}

const ioOpts = {
  timeout: 100,
  forceNew: true,
}

describe('legacy client support', function() {
  // These tests can run a tad long on some machines
  this.timeout(4000)

  let server
  before(async () => {
    server = proxyquire('../server.js', {
      './conf.json': testConfig,
      './lib/frame-converter.js': proxiedFrameConverter,
      './lib/ffmpeg-runner.js': proxiedFfmpegRunner,
    }).default
    await server.readyPromise
  })
  after(() => {
    if (server) {
      server.io.close()
      for (const s of server.servers) {
        s.close()
      }
    }
  })

  it('should allow legacy clients to connect', async () => {
    let socket
    await new Promise((resolve, reject) => {
      socket = sio(`http://localhost:${PORT}`, ioOpts)
      let expectingDisconnect = false
      let messageAcked = false
      socket.on('connect', () => {
        socket.emit('join', 'mp4')
        socket.emit('message', {
          message: 'hi',
          media: EMPTY_FRAMES,
          fingerprint: 'lolhi',
          key: 'ACKME',
        })
      }).on('message', msg => {
        expect(msg).to.have.property('fingerprint')
        expect(msg).to.have.property('message')
        expect(msg).to.have.property('created')
        expect(msg).to.have.property('key')
        expect(msg).to.have.property('media')
        if (messageAcked) {
          expectingDisconnect = true
          resolve()
        }
      }).on('messageack', (err, msg) => {
        expect(err).to.not.exist
        expect(msg.key).to.be.eql('ACKME')
        expect(msg).to.have.property('userId')
        messageAcked = true
      }).on('disconnect', () => {
        if (!expectingDisconnect) {
          reject(new Error('Unexpected disconnect'))
        }
      }).on('error', err => {
        reject(err)
      }).on('connect_timeout', () => reject(new Error('Connection timed out.')))
    })

    await closeSocket(socket)
  })

  it('should properly deliver backscroll', async () => {
    let nonLegacySocket
    let socket
    await new Promise((resolve, reject) => {
      const s = nonLegacySocket = sio(`http://localhost:${PORT}`, ioOpts)
      s.on('connect', () => {
        s.emit('fingerprint', 'lol')
        s.emit('join', 'jpg')
        const frames = []
        for (let i = 0; i < 10; i++) {
          frames.push(new Buffer(0))
        }
        s.emit('chat', { text: 'hi', format: 'image/jpeg', ack: 'sure' }, frames)
        resolve()
      }).on('error', err => {
        reject(err)
      }).on('connect_timeout', () => reject(new Error('Connection timed out.')))
    })

    await new Promise((resolve, reject) => {
      socket = sio(`http://localhost:${PORT}`, ioOpts)
      let expectingDisconnect = false
      socket.on('connect', () => {
        socket.emit('join', 'mp4')
      }).on('message', msg => {
        expect(msg).to.have.property('fingerprint')
        expect(msg).to.have.property('message')
        expect(msg).to.have.property('created')
        expect(msg).to.have.property('key')
        expect(msg).to.have.property('media')

        expectingDisconnect = true
        resolve()
      }).on('disconnect', () => {
        if (!expectingDisconnect) {
          reject(new Error('Unexpected disconnect'))
        }
      }).on('error', err => {
        reject(err)
      }).on('connect_timeout', () => reject(new Error('Connection timed out.')))
    })


    await Promise.all([closeSocket(nonLegacySocket), closeSocket(socket)])
  })
})

function closeSocket(socket) {
  return new Promise((resolve, reject) => {
    // Timeout "fixes" some race condition in socket.io WRT multiple connections. Blergh
    socket.once('disconnect', () => setTimeout(() => resolve(), 50))
    socket.close()
  })
}
