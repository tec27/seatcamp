let io = require('socket.io-client')()
  , initWebrtc = require('./init-webrtc')
  , captureFrames = require('./capture-frames')
  , cuid = require('cuid')
  , Fingerprint = require('fingerprintjs')
  , NotificationCounter = require('./notification-counter')
  , StoredSet = require('./stored-set')
  , createCharCounter = require('./char-counter')
  , createDropdown = require('./dropdown')
  , progressSpinner = require('./progress')(document.querySelector('.progress'))
  , muteSet = new StoredSet('mutes')
  , messageList = require('./message')(document.querySelector('#message-list'), muteSet)

var active = 0
  , meatspaceActive = 0
io.on('connect', function() {
  io.emit('fingerprint', new Fingerprint({ canvas: true }).get())
  io.emit('join', 'jpg')
}).on('disconnect', function() {
  active = 0
  meatspaceActive = 0
  updateActiveUsers()
})

var unreadMessages = 0
io.on('chat', function(chat) {
  var autoScroll = window.pageYOffset + window.innerHeight + 32 > document.body.clientHeight
  var message = messageList.addMessage(chat, autoScroll)
  if (message && autoScroll) {
    message.elem.scrollIntoView()
  }

  if (message && document.hidden) {
    unreadMessages++
    updateNotificationCount()
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
  let elem = document.querySelector('#active-users')
  if (active + meatspaceActive > 0) {
    elem.innerHTML = '' + (active + meatspaceActive)
    elem.title = `${active} active seat.camp users, ${meatspaceActive} meatspace`
  } else {
    elem.innerHTML = '?'
    elem.title = 'not connected'
  }
}

createDropdown(document.querySelector('header .dropdown'), {
  unmute: () => muteSet.clear()
})

var messageInput = document.querySelector('#message')
  , awaitingAck = null

createCharCounter(messageInput, document.querySelector('#char-counter'), 250)

document.querySelector('form').addEventListener('submit', function(event) {
  event.preventDefault()

  if (awaitingAck) return

  messageInput.readonly = true
  awaitingAck = cuid()
  progressSpinner.setValue(0).show()

  captureFrames(document.querySelector('#preview'), {
    format: 'image/jpeg',
    width: 200,
    height: 150
  }, function(err, frames) {
    setTimeout(() => {
      progressSpinner.hide()
      setTimeout(() => progressSpinner.setValue(0), 400)
    }, 400)
    if (err) {
      messageInput.readonly = false
      awaitingAck = null
      // TODO(tec27): show to user
      return console.error(err)
    }

    var message = {
      text: messageInput.value,
      format: 'image/jpeg',
      ack: awaitingAck
    }
    io.emit('chat', message, frames)
    messageInput.value = ''
    // fire 'change'
    let event = document.createEvent('HTMLEvents')
    event.initEvent('change', false, true)
    messageInput.dispatchEvent(event)
  }).on('progress', percentDone => progressSpinner.setValue(percentDone))
})

io.on('ack', function(ack) {
  if (awaitingAck && awaitingAck == ack.key) {
    messageInput.readonly = false
    awaitingAck = null
    if (ack.err) {
      // TODO(tec27): display to user
      console.log('Error: ' + ack.err)
    }
  }
})

initWebrtc(document.querySelector('#preview'), 200, 150, function(err, stream) {
  if (err) {
    // TODO(tec27): display something to user depending on error type
    console.dir(err)
    return
  }

  // TODO(tec27): save stream so it can be stopped later to allow for camera switches
})

document.addEventListener('visibilitychange', () => {
  document.body.classList.toggle('backgrounded', document.hidden)
  if (!document.hidden) {
    unreadMessages = 0
    updateNotificationCount()
  }
})

var notificationCounter = new NotificationCounter()
function updateNotificationCount() {
  if (!unreadMessages) {
    notificationCounter.clear()
  } else {
    notificationCounter.setCount(unreadMessages)
  }
}
