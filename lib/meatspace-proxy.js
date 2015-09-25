import ioClient from 'socket.io-client'
import { EventEmitter } from 'events'
import uriToBuffer from 'data-uri-to-buffer'
import { forMeatspaceProxy as frameConverter } from './frame-converter'

const socketOptions = { 'max reconnection attempts': 1000 }

class IdMap {
  constructor() {
    this._map = Object.create(null)
  }

  inc(id) {
    if (this._map[id]) {
      this._map[id] += 1
    } else {
      this._map[id] = 1
    }
  }

  dec(id) {
    if (!this._map[id]) return false

    if (this._map[id] > 1) {
      this._map[id] -= 1
    } else {
      delete this._map[id]
    }

    return true
  }
}

class MeatspaceProxy extends EventEmitter {
  constructor(server, ffmpegRunner) {
    super()
    this.ffmpegRunner = ffmpegRunner
    this.socket = server ? ioClient(server, socketOptions) : new EventEmitter()
    this.connected = false
    this.awaiting = new IdMap()
    this.lastMessageTime = Date.now()

    this.socket.on('connect', () => {
      this.connected = true
      this.emit('connect')

      this.socket.emit('join', 'webm')
    }).on('connect_error', err => {
      this.emit('connect_error', err)
    }).on('connect_timeout', () => {
      this.emit('connect_timeout')
    }).on('disconnect', () => {
      this.connected = false
      this.emit('disconnect')
    }).on('messageack', (err, ackData) => {
      if (err) return

      this.awaiting.inc(ackData.userId)
    }).on('message', chat => {
      // never replay messages we've already seen
      if (this.lastMessageTime > chat.created) return

      this.onMessage(chat)
    }).on('active', data => {
      this.emit('active', (+data) - 1 /* account for our connection */)
    })
  }

  forward(userId, message, frames) {
    if (!this.connected) return

    const base64Frames = frames.map(frame => 'data:image/jpeg;base64,' + frame.toString('base64'))
    this.socket.emit('message', {
      fingerprint: userId,
      message,
      media: base64Frames
    })
  }

  onMessage(chat) {
    if (this.awaiting.dec(chat.fingerprint)) {
      // This is a message we proxied, drop it!
      return
    } else {
      // This is a message we didn't send, do the final necessary conversions and send it on!
      const converted = {
        fingerprint: chat.fingerprint,
        message: chat.message,
        media: {},
        created: chat.created,
        key: chat.key,
      }

      // decode the webm
      const decoded = uriToBuffer(chat.media)
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
}

export default function createProxy(server, ffmpegRunner) {
  return new MeatspaceProxy(server, ffmpegRunner)
}
