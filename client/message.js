var $ = require('jquery')
  , moment = require('moment')
  , createIdenticon = require('./identicon')

module.exports = function() {
  return new Message()
}

class Message {
  constructor() {
    this._disposed = false
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
    this._checkNotDisposed()
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
  }

  unbind() {
    this._checkNotDisposed()
    // TODO(tec27): implement
  }

  mute() {
    // TODO(tec27): implement
    console.log('mute!')
  }

  dispose() {
    this._checkNotDisposed()
    // TODO(tec27): implement
    this._disposed = true
  }

  get() {
    this._checkNotDisposed()
    return this.root
  }

  _checkNotDisposed() {
    if (this._disposed) {
      throw new Error('Message is already disposed!')
    }
  }
}
