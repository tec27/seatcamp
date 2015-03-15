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
  this.partials = new PartialMediaMap()
  this.dropping = new PartialDropMap()
  this.lastMessageTime = Date.now()

  var self = this
  this.socket.on('connect', function() {
    self.connected = true
    self.emit('connect')

    self.socket.emit('join', 'webm')
    self.socket.emit('join', 'mp4')
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
  if (this.dropping.isDropping(chat) || this.awaiting.dec(chat.fingerprint)) {
    // This is a message we proxied, store it's media (and wait for more media if necessary)
    this.dropping.put(chat)
  } else if (this.partials.put(chat)) {
    // This media file completed the partial collection we had, do the final necessary conversions
    // and send it on!
    let complete = this.partials.remove(chat)
    this.lastMessageTime = chat.created
    frameConverter(complete.media['video/webm'], this.ffmpegRunner, (err, video) => {
      if (err) {
        console.error('Error converting meatspace chat to filmstrip: ' + err)
        return
      }

      complete.media['image/jpeg'] = video
      this.emit('chat', complete)
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

function PartialMediaMap() {
  this._map = Object.create(null)
}

PartialMediaMap.prototype.put = function(chat) {
  if (!this._map[chat.key]) {
    this._map[chat.key] = {
      fingerprint: chat.fingerprint,
      message: chat.message,
      media: {},
      created: chat.created,
      key: chat.key
    }
  }

  var decoded = uriToBuffer(chat.media)
  if (decoded.type != 'video/webm' && decoded.type != 'video/mp4') {
    return
  }
  this._map[chat.key].media[decoded.type] = decoded

  return !!(
    this._map[chat.key].media['video/webm'] &&
    this._map[chat.key].media['video/mp4']
  )
}

PartialMediaMap.prototype.remove = function(chat) {
  var ret = this._map[chat.key]
  delete this._map[chat.key]

  return ret
}

function PartialDropMap() {
  this._map = Object.create(null)
}

var mediaPrefixLen = 'data:video/'.length
PartialDropMap.prototype.put = function(chat) {
  var types = this._map[chat.key] || {}

  var type = chat.media.substr(mediaPrefixLen, 4)
  if (type == 'webm' || type == 'mp4;') {
    types[type] = true
    this._map[chat.key] = types
  }

  if (types.webm && types['mp4;']) {
    delete this._map[chat.key]
    return true
  }

  return false
}

PartialDropMap.prototype.isDropping = function(chat) {
  return !!this._map[chat.key]
}
