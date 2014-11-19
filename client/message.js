var $ = require('jquery')
  , moment = require('moment')
  , Waypoint = require('jquery-waypoints')
  , vid2gif = require('vid2gif')
  , createIdenticon = require('./identicon')

module.exports = function(listElem) {
  return new MessageList(listElem)
}

var MESSAGE_LIMIT = 30
  , MAX_RECYCLED = 6
  , NUM_VIDEO_FRAMES = 10

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
    this._refreshWaypoints()
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
    this._refreshWaypoints()
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

  _refreshWaypoints() {
    if (!this._waypointTimeout) {
      this._waypointTimeout = setTimeout(() => {
        Waypoint.refreshAll()
        this._waypointTimeout = null
      }, 0)
    }
  }
}

var MESSAGE_HTML = [
  '<li>',
    '<div class="video-container">',
      '<video autoplay loop />',
      '<button class="save shadow-1" title="save as GIF">',
        '<div class="icon icon-ic_save_white_24dp" />',
      '</button>',
    '</div>',
    '<p>',
    '<div class="message-meta">',
      '<time/>',
      '<div class="identicon"/>',
      '<div class="flex-grow">',
        '<button class="mute shadow-1" title="mute user">',
          '<div class="icon icon-ic_block_white_24dp" />',
        '</button>',
      '</div>',
    '</div>',
  '</li>',
].join('')


class Message {
  constructor(owner) {
    this._disposed = false
    this._userId = null
    this.owner = owner

    this.root = $(MESSAGE_HTML)
    this.video = this.root.find('video')
    this.saveButton = this.root.find('.save')
    this.chatText = this.root.find('>p')
    this.timestamp = this.root.find('time')
    // placeholder div so it can be replaced with the real thing when bound
    this.identicon = this.root.find('.identicon')
    this.muteButton = this.root.find('.mute')

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

    this.saveButton.on('click', () => this.saveGif())
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

  saveGif() {
    this._throwIfDisposed()
    this.saveButton.prop('disabled', true)
    vid2gif(this.video[0], NUM_VIDEO_FRAMES, (err, gifBlob) => {
      this.saveButton.prop('disabled', false)
      if (err) {
        // TODO(tec27): need a good way to display this error to users
        console.error('Error creating GIF:')
        return console.dir(err)
      }

      var url = window.URL.createObjectURL(gifBlob)
        , link = $('<a />')
        , click = document.createEvent('MouseEvents')

      link
        .attr('href', url)
        .attr('download', Date.now() + '.gif')
      click.initMouseEvent('click', true, true, window, 0, 0, 0, 0, 0,
          false, false, false, false, 0, null)
      link[0].dispatchEvent(click)
      window.URL.revokeObjectURL(url)
    })
  }

  mute() {
    this._throwIfDisposed()
    this.owner.muteUser(this._userId)
  }

  handleWaypoint(side, direction) {
    if ((side == 'top' && direction == 'down') || (side == 'bottom' && direction == 'up')) {
      this.root.addClass('displayed')
      // Workaround for a bug in Chrome where calling play() on a looping video that is on or
      // around its last frame results in it thinking its playing, but actually being paused
      if (this.video[0].duration &&
          Math.abs(this.video[0].currentTime - this.video[0].duration) < 0.2) {
        this.video[0].currentTime = 0
      }
      this.video[0].play()
    } else {
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
