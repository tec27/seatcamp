var frameConverter = require('./frame-converter')
  , cuid = require('cuid')
  , crypto = require('crypto')

module.exports = function(io, userIdKey, historyLimit, historyExpiryMs) {
  return new ChatSockets(io, userIdKey, historyLimit, historyExpiryMs)
}

var mimeTypes = {
  'webm': 'video/webm',
  'x264': 'video/mp4'
}
function ChatSockets(io, userIdKey, historyLimit, historyExpiryMs) {
  this.io = io
  this.userIdKey = userIdKey
  this.historyLimit = historyLimit
  this.historyExpiryMs = historyExpiryMs

  this.history = []

  var self = this
  this.io.on('connection', function(socket) {
    socket.on('chat', function(message, frames) {
      self.handleIncoming(socket, message, frames)
    }).on('join', function(roomName) {
      if (mimeTypes[roomName]) {
        socket.join(roomName)
        self.sendHistory(socket, roomName)
      }
    }).on('fingerprint', function(fingerprint) {
      if (socket.__userId) {
        return socket.emit('error', 'fingerprint already set')
      }
      if (!fingerprint || fingerprint.length > 100) {
        socket.emit('error', 'invalid fingerprint')
        socket.disconnect()
      }

      socket.__userId = crypto.createHash('md5').update(fingerprint + self.userIdKey).digest('hex')
      socket.emit('userid', socket.__userId)
    })
  })
}

ChatSockets.prototype.sendHistory = function(socket, videoType) {
  var now = Date.now()
  while (this.history.length > 0 && now - this.history[0].created > this.historyExpiryMs) {
    this.history.shift()
  }

  for (var i = 0; i < this.history.length; i++) {
    this.emitChatInFormat(
        socket, this.history[i].chat, this.history[i].videos[videoType], videoType)
  }
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
  if (!frames) {
    ack.err = 'invalid frames'
    return socket.emit('ack', ack)
  }
  if (!message.format || message.format != 'image/jpeg') {
    ack.err = 'invalid frame format'
    return socket.emit('ack', ack)
  }

  message.text = transformText(message.text || '')

  var self = this
  frameConverter(frames, message.format, function(err, video) {
    if (err) {
      console.error('error: ' + err)
      ack.err = 'unable to convert frames'
      return socket.emit('ack', ack)
    }

    var chat = {
      key: cuid(),
      text: message.text,
      sent: Date.now(),
      userId: socket.__userId,
    }
    self.history.push({ chat: chat, videos: video })
    if (self.history.length > self.historyLimit) {
      self.history.shift()
    }
    socket.emit('ack', ack)
    self.emitChat(chat, video)
  })
}

ChatSockets.prototype.emitChat = function(chatData, videos) {
  var self = this
  Object.keys(videos).forEach(function(videoType) {
    self.emitChatInFormat(self.io.to(videoType), chatData, videos[videoType], videoType)
  })
}

ChatSockets.prototype.emitChatInFormat = function(target, data, video, videoType) {
  var packet = Object.create(data)
  packet.video = video
  packet.videoType = videoType
  packet.videoMime = mimeTypes[videoType]
  target.emit('chat', packet)
}

function transformText(text) {
  return text.slice(0, 250)
}
