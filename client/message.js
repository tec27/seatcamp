let Waypoint = require('waypoints')
  , filmstrip2gif = require('filmstrip2gif')
  , createIdenticon = require('./identicon')
  , svgIcons = require('./svg-icons')
  , createDropdown = require('./dropdown')
  , localeTime = require('./locale-time')
  , theme = require('./theme')

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

    theme.on('themeChange', newTheme => this._onThemeChange(newTheme))
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
    this.elem.appendChild(message.elem)
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
      message.elem.parentElement.removeChild(message.elem)
      message.unbind()
    }

    var toRecycle = Math.max(MAX_RECYCLED - this._recycled.length, 0)
    toRecycle = Math.min(toRecycle, messages.length)
    this._recycled = this._recycled.concat(messages.slice(0, toRecycle))
    for (let message of messages.slice(toRecycle, messages.length)) {
      message.elem.parentElement.removeChild(message.elem)
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

  _onThemeChange(newTheme) {
    // Re-render identicons based on the new theme to update any inline styles
    for (let message of this.messages) {
      message.refreshIdenticon()
    }
  }
}

var MESSAGE_HTML = [
  '<div class="video-container">',
    '<div class="filmstrip"></div>',
    '<button class="save shadow-1" title="Save as GIF"></button>',
  '</div>',
  '<p>',
  '<div class="message-meta">',
    '<div class="dropdown">',
      '<button class="toggle message-overflow" title="Message options"></button>',
      '<div class="menu shadow-2">',
        '<button data-action="mute">Mute user</button>',
      '</div>',
    '</div>',
    '<div class="identicon"></div>',
    '<time></time>',
  '</div>',
].join('')

class Message {
  constructor(owner) {
    this._disposed = false
    this._userId = null
    this._isFilmstrip = false
    this._srcUrl = null
    this.owner = owner

    this.root = document.createElement('li')
    this.root.innerHTML = MESSAGE_HTML
    this.videoContainer = this.root.querySelector('.video-container')
    this.filmstrip = this.root.querySelector('.filmstrip')
    this.saveButton = this.root.querySelector('.save')
    this.chatText = this.root.querySelector('p')
    this.timestamp = this.root.querySelector('time')
    // placeholder div so it can be replaced with the real thing when bound
    this.identicon = this.root.querySelector('.identicon')
    this.messageOverflow = this.root.querySelector('.message-overflow')

    // generate icons where needed
    this.saveButton.appendChild(svgIcons.save('invert'))
    this.messageOverflow.appendChild(svgIcons.moreVert('normal'))

    this.waypoints = [
      new Waypoint({
        element: this.root,
        offset: () => -this.root.clientHeight,
        handler: direction => this.handleWaypoint('bottom', direction),
      }),
      new Waypoint({
        element: this.root,
        offset: '100%',
        handler: direction => this.handleWaypoint('top', direction),
      }),
    ]
    for (let waypoint of this.waypoints) {
      waypoint.disable()
    }

    this.saveButton.addEventListener('click', () => this.saveGif())
    this.dropdown = createDropdown(this.messageOverflow.parentElement, {
      mute: () => this.mute()
    })
  }

  bind({ key, text, sent, userId, from, video, videoMime, videoType }) {
    this._throwIfDisposed()
    this.unbind()

    var blob = new Blob([ video ], { type: videoMime })
    this._srcUrl = window.URL.createObjectURL(blob)
    this.filmstrip.style['background-image'] = `url('${this._srcUrl}')`

    this.chatText.innerHTML = text

    var sentDate = new Date(sent)
    this.timestamp.datetime = sentDate.toISOString()
    this.timestamp.innerHTML = localeTime(sentDate)

    this._userId = userId
    this.refreshIdenticon()

    this._key = key
    for (let waypoint of this.waypoints) {
      waypoint.enable()
    }
  }

  refreshIdenticon() {
    var newIdenticon = createIdenticon(this._userId)
    this.identicon.parentElement.replaceChild(newIdenticon, this.identicon)
    this.identicon = newIdenticon
  }

  unbind() {
    this._throwIfDisposed()
    this._userId = null
    this._key = null
    this._isFilmstrip = false
    this.dropdown.close()

    delete this.filmstrip.style['background-image']

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
    this.saveButton.disabled = true

    let cb = (err, gifBlob) => {
      this.saveButton.disabled = false
      if (err) {
        // TODO(tec27): need a good way to display this error to users
        console.error('Error creating GIF:')
        return console.dir(err)
      }

      var url = window.URL.createObjectURL(gifBlob)
        , link = document.createElement('a')
        , click = document.createEvent('MouseEvents')

      link.href = url
      link.download = Date.now() + '.gif'
      click.initMouseEvent('click', true, true, window, 0, 0, 0, 0, 0,
          false, false, false, false, 0, null)
      link.dispatchEvent(click)
      setTimeout(() => window.URL.revokeObjectURL(url), 100)
    }

    filmstrip2gif(this._srcUrl, FILMSTRIP_DURATION, NUM_VIDEO_FRAMES, FILMSTRIP_HORIZONTAL, cb)
  }

  mute() {
    this._throwIfDisposed()
    this.owner.muteUser(this._userId)
  }

  handleWaypoint(side, direction) {
    if ((side == 'top' && direction == 'down') || (side == 'bottom' && direction == 'up')) {
      this.root.className = 'displayed'
    } else {
      this.root.className = ''
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
