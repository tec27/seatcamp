var frameConverter = require('./frame-converter')
  , cuid = require('cuid')
  , crypto = require('crypto')
  , twitterText = require('twitter-text')
  , tokenthrottle = require('tokenthrottle')

module.exports = function(io, userIdKey, meatspaceProxy, historyLimit, historyExpiryMs) {
  return new ChatSockets(io, userIdKey, meatspaceProxy, historyLimit, historyExpiryMs)
}

var mimeTypes = {
  'webm': 'video/webm',
  'x264': 'video/mp4'
}
function ChatSockets(io, userIdKey, meatspaceProxy, ffmpegRunner, historyLimit, historyExpiryMs) {
  this.io = io
  this.userIdKey = userIdKey
  this.meatspaceProxy = meatspaceProxy
  this.ffmpegRunner = ffmpegRunner
  this.historyLimit = historyLimit
  this.historyExpiryMs = historyExpiryMs

  this.history = []
  this.meatspaceActive = 0

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
    var address = socket.conn.remoteAddress
    if (socket.request.headers['x-forwarded-for']) {
      address = socket.request.headers['x-forwarded-for'].split(/ *, */)[0]
    }

    this._connectThrottle.rateLimit(address, (err, limited) => {
      if (err) {
        console.error('Error checking rate limit for connection: ', err)
        return next()
      }
      if (limited) {
        return next(new Error('Exceeded connection limit'))
      }

      next()
    })
  })

  this.io.on('connection', socket => {
    socket.emit('meatspace', this.meatspaceProxy.connected ? 'connected' : 'disconnected')
    socket.emit('meatspaceActive', this.meatspaceActive)

    socket.on('chat', (message, frames) => this.handleIncoming(socket, message, frames))
      .on('join', roomName => {
        if (mimeTypes[roomName]) {
          socket.join(roomName)
          this.sendHistory(socket, roomName)
        }
      }).on('fingerprint', fingerprint => {
        if (socket.__userId) {
          return socket.emit('error', 'fingerprint already set')
        }
        if (!fingerprint || fingerprint.length > 100) {
          socket.emit('error', 'invalid fingerprint')
          socket.disconnect()
        }

        socket.__userId =
            crypto.createHash('md5').update(fingerprint + this.userIdKey).digest('hex')
        socket.emit('userid', socket.__userId)
      })
  })

  this.meatspaceProxy.on('connect', () => {
    this.meatspaceActive = 0
    this.io.emit('meatspace', 'connected')
  }).on('disconnect', () => {
    this.meatspaceActive = 0
    this.io.emit('meatspace', 'disconnected')
    console.error(new Date() + ': meatspace proxy disconnected')
  }).on('connect_error', err => {
    console.error(new Date() + ': meatspace proxy connect error: ' + err)
  }).on('connect_timeout', () => {
    console.error(new Date() + ': meatspace proxy connection timeout')
  }).on('active', numActive => {
    this.meatspaceActive = numActive
    this.io.emit('meatspaceActive', numActive)
  }).on('chat', chat => {
    this.convertFromMeatspace(chat)
  })
}

ChatSockets.prototype.sendHistory = function(socket, videoType) {
  var now = Date.now()
  while (this.history.length && now - this.history[0].chat.sent > this.historyExpiryMs) {
    this.history.shift()
  }

  for (var i = 0; i < this.history.length; i++) {
    this.emitChatInFormat(
        socket, this.history[i].chat, this.history[i].videos[videoType], videoType)
  }
}

ChatSockets.prototype.addToHistory = function(chat, videos) {
  this.history.push({ chat: chat, videos: videos })
  if (this.history.length > this.historyLimit) {
    this.history.shift()
  }

  this.emitChat(chat, videos)
}

ChatSockets.prototype.handleIncoming = function(socket, message, frames) {
  if (!socket.__userId) {
    return socket.emit('error', 'no fingerprint set')
  }
  if (!message) {
    return socket.emit('error', 'invalid message')
  }
  var ack = {
    key: '' + message.ack
  }

  this._messageThrottle.rateLimit(socket.__userId, (err, limited) => {
    if (err) {
      console.error('Error ratelimiting message:', err)
    } else if (limited) {
      ack.err = 'exceeded message limit'
      return socket.emit('ack', ack)
    }

    if (!frames) {
      ack.err = 'invalid frames'
      return socket.emit('ack', ack)
    }
    if (!message.format || message.format != 'image/jpeg') {
      ack.err = 'invalid frame format'
      return socket.emit('ack', ack)
    }

    frameConverter(frames, message.format, this.ffmpegRunner, (err, video) => {
      if (err) {
        console.error('error: ' + err)
        ack.err = 'unable to convert frames'
        return socket.emit('ack', ack)
      }

      this.meatspaceProxy.forward(socket.__userId, message.text, frames)

      var transformedText = transformText(message.text || '')
      var chat = {
        key: cuid(),
        text: transformedText,
        sent: Date.now(),
        userId: socket.__userId,
        from: 'seatcamp'
      }
      socket.emit('ack', ack)
      this.addToHistory(chat, video)
    })
  })
}

ChatSockets.prototype.emitChat = function(chatData, videos) {
  for (let videoType of Object.keys(videos)) {
    this.emitChatInFormat(this.io.to(videoType), chatData, videos[videoType], videoType)
  }
}

ChatSockets.prototype.emitChatInFormat = function(target, data, video, videoType) {
  var packet = Object.create(data)
  packet.video = video
  packet.videoType = videoType
  packet.videoMime = mimeTypes[videoType]
  target.emit('chat', packet)
}

function transformText(text) {
  var sanitized = text.slice(0, 250).replace(/[\r\n\t]/,'')
    , entities =
        twitterText.extractEntitiesWithIndices(sanitized, { extractUrlsWithoutProtocol: true})
  var linkified = twitterText.autoLinkEntities(sanitized, entities, {
    htmlEscapeNonEntities: true,
    targetBlank: true,
    usernameIncludeSymbol: true,
  })

  return linkified
}

var mimeToSeatcamp = {}
Object.keys(mimeTypes).forEach(function(type) {
  mimeToSeatcamp[mimeTypes[type]] = type
})
ChatSockets.prototype.convertFromMeatspace = function(meatspaceChat) {
  var seatcampChat = {
    key: cuid(),
    text: meatspaceChat.message,
    sent: meatspaceChat.created,
    userId: meatspaceChat.fingerprint,
    from: 'meatspace'
  }
  var videos = {}
  Object.keys(meatspaceChat.media).forEach(function(mime) {
    videos[mimeToSeatcamp[mime]] = meatspaceChat.media[mime]
  })

  this.addToHistory(seatcampChat, videos)
}
