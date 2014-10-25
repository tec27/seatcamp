var frameConverter = require('./frame-converter')
  , cuid = require('cuid')

module.exports = function(io, historyLimit, historyExpiryMs) {
  return new ChatSockets(io, historyLimit, historyExpiryMs)
}

var mimeTypes = {
  'webm': 'video/webm',
  'x264': 'video/mp4'
}
function ChatSockets(io, historyLimit, historyExpiryMs) {
  this.io = io
  this.historyLimit = historyLimit
  this.historyExpiryMs = historyExpiryMs

  this.history = []

  var self = this
  this.io.on('connection', function(socket) {
    self.sendHistory(socket)

    socket.on('chat', function(message, frames) {
      self.handleIncoming(socket, message, frames)
    }).on('join', function(roomName) {
      if (mimeTypes[roomName]) {
        socket.join(roomName)
      }
    })
  })
}

ChatSockets.prototype.sendHistory = function(socket) {
  var now = Date.now()
  while (this.history.length > 0 && now - this.history[0].created > this.historyExpiryMs) {
    this.history.shift()
  }

  for (var i = 0; i < this.history.length; i++) {
    this.emitChat(this.history[i].chat, this.history[i].videos)
  }
}

ChatSockets.prototype.handleIncoming = function(socket, message, frames) {
  if (!message || !frames) {
    // TODO(tec27): error handling
    return
  }
  if (!message.format) {
    return
  }

  var self = this
  frameConverter(frames, message.format, function(err, video) {
    if (err) {
      console.error('error: ' + err)
      return
    }

    var chat = {
      key: cuid(),
      text: message.text,
      sent: Date.now(),
      userId: 'TODO',
    }
    self.history.push({ chat: chat, videos: video })
    if (self.history.length > self.historyLimit) {
      self.history.shift()
    }
    self.emitChat(chat, video)
  })
}

ChatSockets.prototype.emitChat = function(chatData, videos) {
  var packet = Object.create(chatData)
    , self = this
  Object.keys(videos).forEach(function(videoType) {
    packet.video = videos[videoType]
    packet.videoType = videoType
    packet.videoMime = mimeTypes[videoType]
    self.io.to(videoType).emit('chat', packet)
  })
}
