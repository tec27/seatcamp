import frameConverter from './frame-converter'
import cuid from 'cuid'
import crypto from 'crypto'
import twitterText from 'twitter-text'
import tokenthrottle from 'tokenthrottle'
import uriToBuffer from 'data-uri-to-buffer'

function transformText(text) {
  const sanitized = text.slice(0, 250).replace(/[\r\n\t]/, '')
  const entities =
      twitterText.extractEntitiesWithIndices(sanitized, { extractUrlsWithoutProtocol: true})
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
  if ((firstDword & 0xFFFFFF00) >>> 0 !== 0xFFD8FF00) {
    return false
  }
  const fourthByte = firstDword & 0xFF
  if (fourthByte === 0xD8) {
    return true
  } else if (fourthByte === 0xE0) {
    const jfif = buffer.readUInt32BE(6)
    const additional = buffer.readUInt16BE(10)
    if (jfif !== 0x4A464946 || additional !== 0x0001) {
      return false
    }
    return true
  } else if (fourthByte === 0xE1) {
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
  jpg: 'image/jpeg',
  mp4: 'video/mp4',
}
const mimeToSeatcamp = {}
Object.keys(mimeTypes).forEach(function(type) {
  mimeToSeatcamp[mimeTypes[type]] = type
})
export default class ChatSockets {
  constructor(
      io, userIdKey, ffmpegRunner, historyLimit, historyExpiryMs, expiryGainFactor, imageMagick7) {
    this.io = io
    this.userIdKey = userIdKey
    this.ffmpegRunner = ffmpegRunner
    this.historyLimit = historyLimit
    this.historyExpiryMs = historyExpiryMs
    this.expiryGainFactor = expiryGainFactor
    this.imageMagick7 = imageMagick7
    this.userIdMap = new WeakMap()

    // Build a quick lookup for expiry times (including gain factor), indexed by the number of
    // messages in the history when making the check
    this.expiryTimes = [ 0 ]
    for (let i = 1; i <= this.historyLimit; i++) {
      this.expiryTimes[i] = this.historyExpiryMs *
          (this.expiryGainFactor ** (this.historyLimit - i))
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
      socket.on('chat', (message, frames) => this.handleIncoming(socket, message, frames))
        .on('message', message => this.handleIncomingLegacy(socket, message))
        .on('join', roomName => {
          if (mimeTypes[roomName]) {
            socket.join(roomName)
            this.sendHistory(socket, roomName)
          }
        }).on('fingerprint', fingerprint => {
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
    })
  }

  setFingerprintForSocket(socket, specified) {
    const id = crypto.createHash('md5').update(specified + this.userIdKey).digest('hex')
    this.userIdMap.set(socket, id)
    socket.emit('userid', id)
  }

  sendHistory(socket, videoType) {
    const now = Date.now()
    while (this.history.length &&
        now - this.history[0].chat.sent > this.expiryTimes[this.history.length]) {
      this.history.shift()
    }

    for (let i = 0; i < this.history.length; i++) {
      this.emitChatInFormat(
          socket, this.history[i].chat, this.history[i].videos[videoType], videoType)
    }
  }

  addToHistory(chat, videos) {
    this.history.push({ chat, videos })
    if (this.history.length > this.historyLimit) {
      this.history.shift()
    }

    this.emitChat(chat, videos)
  }

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
      key: '' + message.ack
    }

    this._messageThrottle.rateLimit(this.userIdMap.get(socket), (err, limited) => {
      if (err) {
        console.error('Error ratelimiting message:', err)
      } else if (limited) {
        ack.err = 'exceeded message limit'
        socket.emit('ack', ack)
        return
      }

      // TODO(tec27): allowing variable frame counts should be fairly easy, we should do this
      if (!frames || !Array.isArray(frames) || frames.length !== 10 ||
          !frames.every(f => verifyJpegHeader(f))) {
        ack.err = 'invalid frames'
        socket.emit('ack', ack)
        return
      }
      if (!message.format || message.format !== 'image/jpeg') {
        ack.err = 'invalid frame format'
        socket.emit('ack', ack)
        return
      }

      frameConverter(frames, message.format, this.ffmpegRunner, this.imageMagick7, (err, video) => {
        if (err) {
          console.error('error: ' + err)
          ack.err = 'unable to convert frames'
          socket.emit('ack', ack)
          return
        }

        const chat = createChat(this.userIdMap.get(socket), message.text)
        socket.emit('ack', ack)
        this.addToHistory(chat, video)
      })
    })
  }

  handleIncomingLegacy(socket, data) {
    // handles packets from legacy meatspac-v2 clients (namely, iOS)
    const ackData = { key: data.key }

    if (!data.fingerprint || data.fingerprint.length > 32) {
      socket.emit('messageack', 'Invalid fingerprint', ackData)
      return
    }
    if (!this.userIdMap.has(socket)) {
      this.setFingerprintForSocket(socket, data.fingerprint)
    }

    const userId = this.userIdMap.get(socket)
    ackData.userId = userId

    this._messageThrottle.rateLimit(userId, (err, limited) => {
      if (err) {
        console.error('Error ratelimiting message:', err)
      } else if (limited) {
        socket.emit('messageack', 'Exceeded message limit', ackData)
        return
      }

      if (!data.media || !Array.isArray(data.media) || data.media.length !== 10) {
        socket.emit('messageack', 'Invalid message: invalid media', ackData)
        return
      }
      const frames = data.media.map(frame => {
        return uriToBuffer(frame)
      })
      for (const f of frames) {
        if (f.type !== 'image/jpeg') {
          socket.emit('messageack',
              'Invalid message: media must be of type image/jpeg', ackData)
          return
        }
      }
      frameConverter(frames, 'image/jpeg', this.ffmpegRunner, this.imageMagick7, (err, video) => {
        if (err) {
          console.error('error: ' + err)
          socket.emit('messageack', 'Unable to convert frames', ackData)
          return
        }

        const chat = createChat(userId, data.message)
        socket.emit('messageack', null, ackData)
        this.addToHistory(chat, video)
      })
    })
  }

  emitChat(chatData, videos) {
    for (const videoType of Object.keys(videos)) {
      this.emitChatInFormat(this.io.to(videoType), chatData, videos[videoType], videoType)
    }
  }

  emitChatInFormat(target, data, video, videoType) {
    if (videoType !== 'mp4') {
      const packet = Object.create(data)
      packet.video = video
      packet.videoType = videoType
      packet.videoMime = mimeTypes[videoType]
      target.emit('chat', packet)
    } else {
      // Legacy packets for legacy clients in legacy-land
      const packet = {
        key: data.key,
        message: data.text,
        created: data.sent,
        fingerprint: data.userId,
        media: video,
      }
      target.emit('message', packet)
    }
  }
}
