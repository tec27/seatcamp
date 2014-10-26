var $ = require('jquery')
  , io = require('socket.io-client')()
  , initWebrtc = require('./init-webrtc')
  , captureFrames = require('./capture-frames')
  , cuid = require('cuid')
  , Fingerprint = require('fingerprintjs')

io.on('connect', function() {
  io.emit('fingerprint', new Fingerprint({ canvas: true }).get())
  // TODO(tec27): Pick this based on browser/OS considerations
  io.emit('join', 'webm')
})

var messageList = $('#message-list')
io.on('chat', function(chat) {
  var listItem = $('<li/>')
    , video = $('<video autoplay loop />')
    , chatText = $('<p/>')
    , colorId = $('<div class="color-id" />')

  var blob = new Blob([ chat.video ], { type: chat.videoMime })
    , url = window.URL.createObjectURL(blob)
  video.attr('src', url)

  colorId.css('background-color', '#' + chat.userId.substring(0, 6))
  chatText.text(chat.text)
  listItem.append(video).append(chatText).append(colorId)
  messageList.append(listItem)
}).on('active', function(numActive) {
  $('#active-users').text(numActive)
})

var messageInput = $('#message')
  , awaitingAck = null
$('form').on('submit', function(event) {
  event.preventDefault()

  captureFrames($('#preview')[0], { format: 'image/jpeg' }, function(err, frames) {
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
