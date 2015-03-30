var $ = require('jquery')
  , moment = require('moment')
  , Waypoint = require('jquery-waypoints')
  , filmstrip2gif = require('filmstrip2gif')
  , vid2gif = require('vid2gif')
  , createIdenticon = require('./identicon')
  , svgIcons = require('./svg-icons')
  , createDropdown = require('./dropdown')

module.exports = function(listElem, muteSet) {
  return new MessageList(listElem, muteSet)
}

var MESSAGE_LIMIT = 30
  , MAX_RECYCLED = 6
  , NUM_VIDEO_FRAMES = 10
  , FILMSTRIP_DURATION = 0.92
  , FILMSTRIP_HORIZONTAL = false

class MessageList {
  constructor(listElem, muteSet) {
    this.elem = listElem
    this.messages = []
    this.messageKeys = new Set()
    this._recycled = []

    this._mutes = muteSet
  }

  addMessage(chat, removeOverLimit = true) {
    if (this._mutes.has(chat.userId)) {
      return
    }
    if (this.messageKeys.has(chat.key)) {
      return
    }

    var newCount = this.messages.length + 1
    if (removeOverLimit && newCount > MESSAGE_LIMIT) {
      let removed = this.messages.splice(0, newCount - MESSAGE_LIMIT)
      this._recycle(removed)
    }

    var message = this._recycled.length ? this._recycled.pop() : new Message(this)
    message.bind(chat)
    this.messages.push(message)
    this.messageKeys.add(message.key)
    this.elem.append(message.elem)
    this._refreshWaypoints()
    return message
  }

  muteUser(userId) {
    this._mutes.add(userId)

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
      this.messageKeys.delete(message.key)
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
      '<video loop webkit-playsinline />',
      '<div class="filmstrip" />',
      '<button class="save shadow-1" title="Save as GIF">',
      '</button>',
    '</div>',
    '<p>',
    '<div class="message-meta">',
      '<div class="dropdown">',
        '<button class="toggle message-overflow" title="Message options"></button>',
        '<div class="menu shadow-2">',
          '<button data-action="mute">Mute user</button>',
        '</div>',
      '</div>',
      '<div class="identicon"/>',
      '<time/>',
    '</div>',
  '</li>',
].join('')


class Message {
  constructor(owner) {
    this._disposed = false
    this._userId = null
    this._isFilmstrip = false
    this._srcUrl = null
    this.owner = owner

    this.root = $(MESSAGE_HTML)
    this.videoContainer = this.root.find('.video-container')
    this.video = this.root.find('video')
    this.filmstrip = this.root.find('.filmstrip')
    this.saveButton = this.root.find('.save')
    this.chatText = this.root.find('>p')
    this.timestamp = this.root.find('time')
    // placeholder div so it can be replaced with the real thing when bound
    this.identicon = this.root.find('.identicon')
    this.messageOverflow = this.root.find('.message-overflow')

    // generate icons where needed
    this.saveButton.append(svgIcons.save('white'))
    this.messageOverflow.append(svgIcons.moreVert('grey600'))

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
    this.dropdown = createDropdown(this.messageOverflow.parent(), {
      mute: () => this.mute()
    })
  }

  bind({ key, text, sent, userId, from, video, videoMime, videoType }) {
    this._throwIfDisposed()
    this.unbind()

    var blob = new Blob([ video ], { type: videoMime })
    this._srcUrl = window.URL.createObjectURL(blob)
    // TODO(tec27): make this hack more general/less of a hack?
    this._isFilmstrip = videoMime == 'image/jpeg'
    if (!this._isFilmstrip) {
      this.video.attr('src', this._srcUrl)
    } else {
      this.videoContainer.addClass('use-filmstrip')
      this.filmstrip.css('background-image', `url('${this._srcUrl}')`)
    }

    this.chatText.html(text)

    var sentDate = moment(new Date(sent))
    this.timestamp.attr('datetime', sentDate.toISOString()).text(sentDate.format('LT'))

    var newIdenticon = createIdenticon(userId)
    this.identicon.replaceWith(newIdenticon)
    this.identicon = newIdenticon

    this._userId = userId
    this._key = key
    for (let waypoint of this.waypoints) {
      waypoint.enable()
    }
  }

  unbind() {
    this._throwIfDisposed()
    this._userId = null
    this._key = null
    this._isFilmstrip = false
    this.dropdown.close()

    this.video.attr('src', '')
    this.videoContainer.removeClass('use-filmstrip')
    this.filmstrip.css('background-image', '')

    if(this._srcUrl) {
      window.URL.revokeObjectURL(this._srcUrl)
      this._srcUrl = null
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

    let cb = (err, gifBlob) => {
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
    }

    if (this._isFilmstrip) {
      filmstrip2gif(this._srcUrl, FILMSTRIP_DURATION, NUM_VIDEO_FRAMES, FILMSTRIP_HORIZONTAL, cb)
    } else {
      vid2gif(this.video[0], NUM_VIDEO_FRAMES, cb)
    }
  }

  mute() {
    this._throwIfDisposed()
    this.owner.muteUser(this._userId)
  }

  handleWaypoint(side, direction) {
    if ((side == 'top' && direction == 'down') || (side == 'bottom' && direction == 'up')) {
      this.root.addClass('displayed')
      if (this._isFilmstrip) return
      // Workaround for a bug in Chrome where calling play() on a looping video that is on or
      // around its last frame results in it thinking its playing, but actually being paused
      if (this.video[0].duration &&
          Math.abs(this.video[0].currentTime - this.video[0].duration) < 0.2) {
        this.video[0].currentTime = 0
      }
      playVideo(this.video[0])
    } else {
      this.root.removeClass('displayed')
      if (!this.isFilmstrip) {
        this.video[0].pause()
      }
    }
    // TODO(tec27): tell owner about this so it can recycle on scrolling?
  }

  get elem() {
    return this.root
  }

  get userId() {
    return this._userId
  }

  get key() {
    return this._key
  }

  _throwIfDisposed() {
    if (this._disposed) throw new Error('Message already disposed!')
  }
}

// wish there was a better way to detect the "must watch videos in fullscreen only" restriction, but
// as of yet this is all I know
var isSmallIos = /iPhone|iPod/.test(navigator.userAgent)
function playVideo(video) {
  // don't actually call play on small iOS devices since this will cause an annoying video popup
  // for them
  if (!isSmallIos) {
    setTimeout(() => video.play(), 0)
  }
}
