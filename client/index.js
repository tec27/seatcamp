require('traceur/bin/traceur-runtime.js')

var $ = require('jquery')
  , io = require('socket.io-client')()
  , initWebrtc = require('./init-webrtc')
  , captureFrames = require('./capture-frames')
  , cuid = require('cuid')
  , Fingerprint = require('fingerprintjs')
  , moment = require('moment')
  , createIdenticon = require('./identicon')

var active = 0
  , meatspaceActive = 0
io.on('connect', function() {
  io.emit('fingerprint', new Fingerprint({ canvas: true }).get())
  // TODO(tec27): Pick this based on browser/OS considerations
  io.emit('join', 'webm')
}).on('disconnect', function() {
  active = 0
  meatspaceActive = 0
  updateActiveUsers()
})

var MESSAGE_LIMIT = 30
var messageList = $('#message-list')
io.on('chat', function(chat) {
  var listItem = $('<li/>')
    , video = $('<video autoplay loop />')
    , contentDiv = $('<div class="message-content" />')
    , chatText = $('<p/>')
    , timestamp = $('<time />')
    , identicon = createIdenticon(chat.userId)

  var blob = new Blob([ chat.video ], { type: chat.videoMime })
    , url = window.URL.createObjectURL(blob)
  video.attr('src', url)

  if (chat.from == 'meatspace') {
    chatText.html(chat.text)
  } else {
    chatText.text(chat.text)
  }

  var sentDate = moment(new Date(chat.sent))
  timestamp.attr('datetime', sentDate.toISOString()).text(sentDate.format('LT'))
  contentDiv.append(chatText).append(timestamp).append(identicon)
  listItem.append(video).append(contentDiv)

  var autoScroll = $(window).scrollTop() + $(window).height() + 32 > $(document).height()
  messageList.append(listItem)

  if (autoScroll) {
    var children = messageList.children()
    if (children.length > MESSAGE_LIMIT) {
      children.slice(0, children.length - MESSAGE_LIMIT).each(function() {
        $(this).remove()
      })
    }

    listItem[0].scrollIntoView()
  }
}).on('active', function(numActive) {
  active = numActive
  updateActiveUsers()
}).on('meatspaceActive', function(numActive) {
  meatspaceActive = numActive
  updateActiveUsers()
}).on('meatspace', function(status) {
  if (status != 'connected') {
    meatspaceActive = 0
    updateActiveUsers()
  }
})

function updateActiveUsers() {
  $('#active-users')
    .text(active + meatspaceActive)
    .attr('title', `${active} active seat.camp users, ${meatspaceActive} meatspace`)
}

var messageInput = $('#message')
  , awaitingAck = null
$('form').on('submit', function(event) {
  event.preventDefault()

  captureFrames($('#preview')[0], {
    format: 'image/jpeg',
    width: 200,
    height: 150
  }, function(err, frames) {
    if (err) {
      return console.error(err)
    }

    awaitingAck = cuid()
    var message = {
      text: messageInput.val(),
      format: 'image/jpeg',
      ack: awaitingAck
    }
    io.emit('chat', message, frames)
    messageInput.val('')
  }).on('progress', function(percentDone) {
    console.log('progress: ' + percentDone)
  })
})

io.on('ack', function(ack) {
  if (awaitingAck && awaitingAck == ack.key) {
    awaitingAck = null
    if (ack.err) {
      // TODO(tec27): display to user
      console.log('Error: ' + ack.err)
    }
  }
})

initWebrtc($('#preview')[0], 200, 150, function(err, stream) {
  if (err) {
    // TODO(tec27): display something to user depending on error type
    console.dir(err)
    return
  }

  // TODO(tec27): save stream so it can be stopped later to allow for camera switches
})
