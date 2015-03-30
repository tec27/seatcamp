var ioClient = require('socket.io-client')
  , inherits = require('util').inherits
  , EventEmitter = require('events').EventEmitter
  , uriToBuffer = require('data-uri-to-buffer')
  , frameConverter = require('./frame-converter').forMeatspaceProxy

module.exports = function(server, ffmpegRunner) {
  return new MeatspaceProxy(server, ffmpegRunner)
}

var socketOptions = { 'max reconnection attempts': 1000 }

inherits(MeatspaceProxy, EventEmitter)
function MeatspaceProxy(server, ffmpegRunner) {
  EventEmitter.call(this)
  this.ffmpegRunner = ffmpegRunner
  this.socket = !!server ? ioClient(server, socketOptions) : new EventEmitter()
  this.connected = false
  this.awaiting = new IdMap()
  this.lastMessageTime = Date.now()

  var self = this
  this.socket.on('connect', function() {
    self.connected = true
    self.emit('connect')

    self.socket.emit('join', 'webm')
  }).on('connect_error', function(err) {
    self.emit('connect_error', err)
  }).on('connect_timeout', function() {
    self.emit('connect_timeout')
  }).on('disconnect', function() {
    self.connected = false
    self.emit('disconnect')
  }).on('messageack', function(err, ackData) {
    if (err) return

    self.awaiting.inc(ackData.userId)
  }).on('message', function(chat) {
    // never replay messages we've already seen
    if (self.lastMessageTime > chat.created) return

    self.onMessage(chat)
  }).on('active', function(data) {
    self.emit('active', (+data) - 1 /* account for our connection */)
  })
}

MeatspaceProxy.prototype.forward = function(userId, message, frames) {
  if (!this.connected) return

  var base64Frames = frames.map(function(frame) {
    return 'data:image/jpeg;base64,' + frame.toString('base64')
  })
  this.socket.emit('message', {
    fingerprint: userId,
    message: message,
    media: base64Frames
  })
}

MeatspaceProxy.prototype.onMessage = function(chat) {
  if (this.awaiting.dec(chat.fingerprint)) {
    // This is a message we proxied, drop it!
    return
  } else {
    // This is a message we didn't send, do the final necessary conversions and send it on!
    let converted = {
      fingerprint: chat.fingerprint,
      message: chat.message,
      media: {},
      created: chat.created,
      key: chat.key,
    }

    // decode the webm
    let decoded = uriToBuffer(chat.media)
    this.lastMessageTime = converted.created
    frameConverter(decoded, this.ffmpegRunner, (err, filmstrip) => {
      if (err) {
        console.error('Error converting meatspace chat to filmstrip: ' + err)
        return
      }

      converted.media['image/jpeg'] = filmstrip
      this.emit('chat', converted)
    })
  }
}

function IdMap() {
  this._map = Object.create(null)
}

IdMap.prototype.inc = function(id) {
  if (this._map[id]) {
    this._map[id] += 1
  } else {
    this._map[id] = 1
  }
}

IdMap.prototype.dec = function(id) {
  if (!this._map[id]) return false

  if (this._map[id] > 1) {
    this._map[id] -= 1
  } else {
    delete this._map[id]
  }

  return true
}
