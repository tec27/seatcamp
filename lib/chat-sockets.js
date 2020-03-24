import frameConverter from './frame-converter'
import cuid from 'cuid'
import crypto from 'crypto'
import twitterText from 'twitter-text'
import tokenthrottle from 'tokenthrottle'
import multer from 'multer'
import { PROTOCOL_VERSION } from '../protocol-version'

function transformText(text) {
  const sanitized = text.slice(0, 250).replace(/[\r\n\t]/, '')
  const entities = twitterText.extractEntitiesWithIndices(sanitized, {
    extractUrlsWithoutProtocol: true,
  })
  const linkified = twitterText.autoLinkEntities(sanitized, entities, {
    htmlEscapeNonEntities: true,
    targetBlank: true,
    usernameIncludeSymbol: true,
  })

  return linkified
}

function createChat(userId, text = '') {
  const transformedText = transformText(text)
  return {
    key: cuid(),
    text: transformedText,
    sent: Date.now(),
    userId,
    from: 'seatcamp',
  }
}

// Helps protect against ImageMagick abuse
// Magic values taken from https://en.wikipedia.org/wiki/List_of_file_signatures
function verifyJpegHeader(buffer) {
  if (buffer.length < 12) {
    return false
  }

  const firstDword = buffer.readUInt32BE(0)
  if ((firstDword & 0xffffff00) >>> 0 !== 0xffd8ff00) {
    return false
  }
  const fourthByte = firstDword & 0xff
  if (fourthByte === 0xd8) {
    return true
  } else if (fourthByte === 0xe0) {
    const jfif = buffer.readUInt32BE(6)
    const additional = buffer.readUInt16BE(10)
    if (jfif !== 0x4a464946 || additional !== 0x0001) {
      return false
    }
    return true
  } else if (fourthByte === 0xe1) {
    const exif = buffer.readUInt32BE(6)
    const additional = buffer.readUInt16BE(10)
    if (exif !== 0x45786966 || additional !== 0x0000) {
      return false
    }
    return true
  } else {
    return false
  }
}

const mimeTypes = {
  mp4: 'video/mp4',
}
const mimeToSeatcamp = {}
Object.keys(mimeTypes).forEach(function(type) {
  mimeToSeatcamp[mimeTypes[type]] = type
})
export default class ChatSockets {
  constructor(app, io, userIdKey, ffmpegRunner, historyLimit, historyExpiryMs, expiryGainFactor) {
    this.app = app
    this.io = io
    this.userIdKey = userIdKey
    this.ffmpegRunner = ffmpegRunner
    this.historyLimit = historyLimit
    this.historyExpiryMs = historyExpiryMs
    this.expiryGainFactor = expiryGainFactor
    this.userIdMap = new WeakMap()

    // Build a quick lookup for expiry times (including gain factor), indexed by the number of
    // messages in the history when making the check
    this.expiryTimes = [0]
    for (let i = 1; i <= this.historyLimit; i++) {
      this.expiryTimes[i] = this.historyExpiryMs * this.expiryGainFactor ** (this.historyLimit - i)
    }

    this.history = []

    // throttle for connections (per host)
    this._connectThrottle = tokenthrottle({
      rate: 3,
      burst: 30,
      window: 60 * 1000,
    })
    // throttle for message sending (per socket)
    this._messageThrottle = tokenthrottle({
      rate: 6,
      burst: 18,
      window: 60 * 1000,
    })

    // TODO: let multer handle writing the files instead of the frame converter
    // For now, these are kept in-memory like for the sockets
    const uploadHandler = multer({
      limits: {
        fieldSize: 250 * 1024,
        fileSize: 250 * 1024,
        files: 10,
        parts: 50,
      },
    })
    const messageUpload = uploadHandler.fields([{ name: 'frames', maxCount: 10 }])
    this.app.post('/message', messageUpload, (req, res, next) =>
      this.handleIncomingPost(req, res, next),
    )

    this.io.use((socket, next) => {
      let address = socket.conn.remoteAddress
      if (socket.request.headers['x-forwarded-for']) {
        address = socket.request.headers['x-forwarded-for'].split(/ *, */)[0]
      }

      this._connectThrottle.rateLimit(address, (err, limited) => {
        if (err) {
          console.error('Error checking rate limit for connection: ', err)
          next()
          return
        }
        if (limited) {
          next(new Error('Exceeded connection limit'))
          return
        }

        next()
      })
    })

    this.io.on('connection', socket => {
      socket
        .on('chat', (message, frames) => this.handleIncoming(socket, message, frames))
        .on('join', roomName => {
          if (mimeTypes[roomName]) {
            socket.join(roomName)
            this.sendHistory(socket, roomName)
          }
        })
        .on('fingerprint', fingerprint => {
          if (this.userIdMap.has(socket)) {
            socket.emit('error', 'fingerprint already set')
            return
          }
          if (!fingerprint || fingerprint.length > 100) {
            socket.emit('error', 'invalid fingerprint')
            socket.disconnect()
            return
          }

          this.setFingerprintForSocket(socket, fingerprint)
        })

      socket.emit('protocolVersion', PROTOCOL_VERSION)
    })
  }

  calcUserId(fingerprint) {
    const id = crypto
      .createHash('md5')
      .update(fingerprint + this.userIdKey)
      .digest('hex')
    return id
  }

  setFingerprintForSocket(socket, specified) {
    const id = this.calcUserId(specified)
    this.userIdMap.set(socket, id)
    socket.emit('userid', id)
  }

  sendHistory(socket, videoType) {
    const now = Date.now()
    while (
      this.history.length &&
      now - this.history[0].chat.sent > this.expiryTimes[this.history.length]
    ) {
      this.history.shift()
    }

    for (let i = 0; i < this.history.length; i++) {
      this.emitChatInFormat(
        socket,
        this.history[i].chat,
        this.history[i].videos[videoType],
        videoType,
      )
    }

    socket.emit('historyComplete')
  }

  addToHistory(chat, videos) {
    this.history.push({ chat, videos })
    if (this.history.length > this.historyLimit) {
      this.history.shift()
    }

    this.emitChat(chat, videos)
  }

  // TODO: delete this once we've moved over to form posts
  handleIncoming(socket, message, frames) {
    if (!this.userIdMap.has(socket)) {
      socket.emit('error', 'no fingerprint set')
      return
    }
    if (!message) {
      socket.emit('error', 'invalid message')
      return
    }
    const ack = {
      key: '' + message.ack,
    }

    this._messageThrottle.rateLimit(this.userIdMap.get(socket), (err, limited) => {
      if (err) {
        console.error('Error ratelimiting message:', err)
      } else if (limited) {
        ack.err = 'exceeded message limit'
        socket.emit('ack', ack)
        return
      }

      if (
        !frames ||
        !Array.isArray(frames) ||
        frames.length !== 10 ||
        !frames.every(f => verifyJpegHeader(f))
      ) {
        ack.err = 'invalid frames'
        socket.emit('ack', ack)
        return
      }
      if (!message.format || message.format !== 'image/jpeg') {
        ack.err = 'invalid frame format'
        socket.emit('ack', ack)
        return
      }

      frameConverter(frames, message.format, this.ffmpegRunner).then(
        video => {
          const chat = createChat(this.userIdMap.get(socket), message.text)
          socket.emit('ack', ack)
          this.addToHistory(chat, video)
        },
        err => {
          console.error('error: ' + err)
          ack.err = 'unable to convert frames'
          socket.emit('ack', ack)
        },
      )
    })
  }

  // Handles incoming messages that are POSTed over HTTP (e.g. not websocket)
  handleIncomingPost(req, res, next) {
    const { fingerprint, format, message } = req.body
    if (!fingerprint || fingerprint.length > 100) {
      res.status(400).send('invalid fingerprint')
      return
    }
    if (!message) {
      res.status(400).send('invalid message')
      return
    }

    const frames = req.files.frames
    const userId = this.calcUserId(fingerprint)

    this._messageThrottle.rateLimit(userId, (err, limited) => {
      if (err) {
        console.error('Error ratelimiting message:', err)
      } else if (limited) {
        res.status(429).send('exceeded message limit')
        return
      }

      if (
        !frames ||
        !Array.isArray(frames) ||
        frames.length !== 10 ||
        !frames.every(f => verifyJpegHeader(f.buffer))
      ) {
        res.status(400).send('invalid frames')
        return
      }
      if (!format || format !== 'image/jpeg') {
        res.status(400).send('invalid frame format')
        return
      }

      const frameBuffers = frames.map(f => f.buffer)

      frameConverter(frameBuffers, format, this.ffmpegRunner).then(
        video => {
          const chat = createChat(userId, message)
          res.status(200).send('ok')
          this.addToHistory(chat, video)
        },
        err => {
          console.error('error: ' + err)
          res.status(500).send('unable to convert frames')
        },
      )
    })
  }

  emitChat(chatData, videos) {
    for (const videoType of Object.keys(videos)) {
      this.emitChatInFormat(this.io.to(videoType), chatData, videos[videoType], videoType)
    }
  }

  emitChatInFormat(target, data, video, videoType) {
    target.emit('chat', {
      ...data,
      video,
      videoType,
      videoMime: mimeTypes[videoType],
    })
  }
}
