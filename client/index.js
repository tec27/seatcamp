var $ = require('jquery')
  , io = require('socket.io-client')()
  , initWebrtc = require('./init-webrtc')

io.on('connect', function() {
  console.log('connected!')
})

var messageList = $('#message-list')
io.on('chat', function(chat) {
  messageList.append($('<li/>').text(chat.text))
})

var messageInput = $('#message')
$('form').on('submit', function(event) {
  event.preventDefault()

  io.emit('chat', { text: messageInput.val(), binary: new ArrayBuffer(4) })
  messageInput.val('')
})

initWebrtc($('#preview')[0], 200, 150, function(err, stream) {
  if (err) {
    console.dir(err)
    return
  }

  // TODO(tec27): save stream so it can be stopped later to allow for camera switches
})
