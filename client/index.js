var $ = require('jquery')
  , io = require('socket.io-client')()

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

  io.emit('chat', { text: messageInput.val() })
  messageInput.val('')
})
