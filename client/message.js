var $ = require('jquery')
  , moment = require('moment')
  , Waypoint = require('jquery-waypoints')
  , createIdenticon = require('./identicon')

module.exports = function(listElem) {
  return new MessageList(listElem)
}

var MESSAGE_LIMIT = 30
  , MAX_RECYCLED = 6

class MessageList {
  constructor(listElem) {
    this.elem = listElem
    this.messages = []
    this._recycled = []
  }

  addMessage(chat, removeOverLimit = true) {
    var newCount = this.messages.length + 1
    if (removeOverLimit && newCount > MESSAGE_LIMIT) {
      let removed = this.messages.splice(0, newCount - MESSAGE_LIMIT)
      this._recycle(removed)
    }

    var message = this._recycled.length ? this._recycled.pop() : new Message(this)
    message.bind(chat)
    this.messages.push(message)
    this.elem.append(message.elem)
    Waypoint.refreshAll()
    return message
  }

  muteUser(userId) {
    var userMessages = []
      , nonUserMessages = []
    for (let message of this.messages) {
      if (message.userId == userId) {
        userMessages.push(message)
      } else {
        nonUserMessages.push(message)
      }
    }

    this._recycle(userMessages)
    this.messages = nonUserMessages
    Waypoint.refreshAll()
  }

  _recycle(messages) {
    for (let message of messages) {
      message.elem.detach()
      message.unbind()
    }

    var toRecycle = Math.max(MAX_RECYCLED - this._recycled.length, 0)
    toRecycle = Math.min(toRecycle, messages.length)
    this._recycled = this._recycled.concat(messages.slice(0, toRecycle))
    for (let message of messages.slice(toRecycle, messages.length)) {
      message.elem.remove()
      message.dispose()
    }
  }
}

class Message {
  constructor(owner) {
    this._disposed = false
    this._userId = null
    this.owner = owner

    this.root = $('<li/>')
    this.video = $('<video autoplay loop />')
    this.chatText = $('<p/>')
    this.metaDiv = $('<div class="message-meta" />')
    this.timestamp = $('<time />')
    // placeholder div so it can be replaced with the real thing when bound
    this.identicon = $('<div class="identicon" />')
    var bottomRow = $('<div class="flex-grow" />')
    this.meatspacLogo = $('<img class="meatspac-logo" src="meatspac.png" alt="meatspace user" />')
    this.muteButton = $('<button class="mute shadow-1" title="mute user">' +
        '<div class="icon icon-ic_block_white_24dp" /></button>')

    this.waypoints = [
      new Waypoint({
        element: this.root[0],
        offset: () => -this.root.outerHeight(),
        handler: direction => this.handleWaypoint('bottom', direction),
      }),
      new Waypoint({
        element: this.root[0],
        offset: '100%',
        handler: direction => this.handleWaypoint('top', direction),
      }),
    ]
    for (let waypoint of this.waypoints) {
      waypoint.disable()
    }

    bottomRow
      .append(this.meatspacLogo)
      .append(this.muteButton)
    this.metaDiv
      .append(this.timestamp)
      .append(this.identicon)
      .append(bottomRow)
    this.root
      .append(this.video)
      .append(this.chatText)
      .append(this.metaDiv)

    this.muteButton.on('click', () => this.mute())
  }

  bind({ key, text, sent, userId, from, video, videoMime, videoType }) {
    this._throwIfDisposed()
    this.unbind()

    var blob = new Blob([ video ], { type: videoMime })
      , url = window.URL.createObjectURL(blob)
    this.video.attr('src', url)

    this.chatText.html(text)

    var sentDate = moment(new Date(sent))
    this.timestamp.attr('datetime', sentDate.toISOString()).text(sentDate.format('LT'))

    if (from == 'meatspace') {
      this.root.addClass('meatspac')
    } else {
      this.root.removeClass('meatspac')
    }

    var newIdenticon = createIdenticon(userId)
    this.identicon.replaceWith(newIdenticon)
    this.identicon = newIdenticon

    this._userId = userId
    for (let waypoint of this.waypoints) {
      waypoint.enable()
    }
  }

  unbind() {
    this._throwIfDisposed()
    this._userId = null

    if(this.video.attr('src')) {
      let src = this.video.attr('src')
      this.video.attr('src', '')
      window.URL.revokeObjectURL(src)
    }
    for (let waypoint of this.waypoints) {
      waypoint.disable()
    }
  }

  dispose() {
    this._throwIfDisposed()
    this._disposed = true

    for (let waypoint of this.waypoints) {
      waypoint.destroy()
    }
    this.waypoints.length = 0
  }

  mute() {
    this._throwIfDisposed()
    this.owner.muteUser(this._userId)
  }

  handleWaypoint(side, direction) {
    console.log(`${this.chatText.text()} - ${side} - ${direction}`)
    if ((side == 'top' && direction == 'down') || (side == 'bottom' && direction == 'up')) {
      console.log('displayed!')
      this.root.addClass('displayed')
      // Workaround for a bug in Chrome where calling play() on a looping video that is on or
      // around its last frame results in it thinking its playing, but actually being paused
      if (Math.abs(this.video[0].currentTime - this.video[0].duration) < 0.2) {
        this.video[0].currentTime = 0
      }
      this.video[0].play()
    } else {
      console.log('hidden!')
      this.root.removeClass('displayed')
      this.video[0].pause()
    }
    // TODO(tec27): tell owner about this so it can recycle on scrolling?
  }

  get elem() {
    return this.root
  }

  get userId() {
    return this._userId
  }

  _throwIfDisposed() {
    if (this._disposed) throw new Error('Message already disposed!')
  }
}
