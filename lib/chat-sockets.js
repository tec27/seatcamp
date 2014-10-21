var frameConverter = require('./frame-converter')

module.exports = function(io, historyLimit, historyExpiryMs) {
  return new ChatSockets(io, historyLimit, historyExpiryMs)
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
    })
  })
}

ChatSockets.prototype.sendHistory = function(socket) {
  var now = Date.now()
  while (this.history.length > 0 && now - this.history[0].created > this.historyExpiryMs) {
    this.history.shift()
  }

  for (var i = 0; i < this.history.length; i++) {
    socket.emit('chat', this.history[i])
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

    console.log('sending chat!')
    var chat = {
      text: message.text,
      sent: Date.now(),
      video: video
    }
    self.history.push(chat)
    if (self.history.length > self.historyLimit) {
      self.history.shift()
    }
    self.io.emit('chat', chat)
  })
}
