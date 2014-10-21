var $ = require('jquery')
  , io = require('socket.io-client')()
  , initWebrtc = require('./init-webrtc')
  , captureFrames = require('./capture-frames')

io.on('connect', function() {
  console.log('connected!')
})

var messageList = $('#message-list')
io.on('chat', function(chat) {
  var listItem = $('<li/>')
    , video = $('<video autoplay loop />')
    , chatText = $('<p/>')

  var blob = new Blob([ chat.video ], { type: 'video/webm' })
    , url = window.URL.createObjectURL(blob)
  video.attr('src', url)

  chatText.text(chat.text)
  listItem.append(video).append(chatText)
  messageList.append(listItem)
}).on('active', function(numActive) {
  $('#active-users').text(numActive)
})

var messageInput = $('#message')
$('form').on('submit', function(event) {
  event.preventDefault()

  captureFrames($('#preview')[0], { format: 'image/jpeg' }, function(err, frames) {
    if (err) {
      return console.error(err)
    }

    io.emit('chat', { text: messageInput.val(), format: 'image/jpeg' }, frames)
    messageInput.val('')
  }).on('progress', function(percentDone) {
    console.log('progress: ' + percentDone)
  })
})

initWebrtc($('#preview')[0], 200, 150, function(err, stream) {
  if (err) {
    console.dir(err)
    return
  }

  // TODO(tec27): save stream so it can be stopped later to allow for camera switches
})
