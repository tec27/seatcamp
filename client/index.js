import createSocketIoClient from 'socket.io-client'
import cameraPreview from './camera-preview'
import captureFrames from './capture-frames'
import cuid from 'cuid'
import Fingerprint from 'fingerprintjs'
import NotificationCounter from './notification-counter'
import StoredSet from './stored-set'
import createCharCounter from './char-counter'
import createDropdown from './dropdown'
import initProgressSpinner from './progress'
import initMessageList from './message'
import theme from './theme'
import createAbout from './about'

const io = createSocketIoClient()
const muteSet = new StoredSet('mutes')
const progressSpinner = initProgressSpinner(document.querySelector('.progress'))
const messageList = initMessageList(document.querySelector('#message-list'), muteSet)

const possibleEvents = {
  transition: 'transitionend',
  OTransition: 'oTransitionEnd',
  MozTransition: 'transitionend',
  WebkitTransition: 'webkitTransitionEnd',
}

let transitionEvent
for (const t in possibleEvents) {
  if (document.body.style[t] !== undefined) {
    transitionEvent = possibleEvents[t]
    break
  }
}

let active = 0
let meatspaceActive = 0
io.on('connect', function() {
  io.emit('fingerprint', new Fingerprint({ canvas: true }).get())
  io.emit('join', 'jpg')
}).on('disconnect', function() {
  active = 0
  meatspaceActive = 0
  updateActiveUsers()
})

let unreadMessages = 0
io.on('chat', function(chat) {
  const autoScroll = window.pageYOffset + window.innerHeight + 32 > document.body.clientHeight
  const message = messageList.addMessage(chat, autoScroll)
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
  if (status !== 'connected') {
    meatspaceActive = 0
    updateActiveUsers()
  }
})

function updateActiveUsers() {
  const elem = document.querySelector('#active-users')
  if (active + meatspaceActive > 0) {
    elem.innerHTML = '' + (active + meatspaceActive)
    elem.title = `${active} active seat.camp users, ${meatspaceActive} meatspace`
  } else {
    elem.innerHTML = '?'
    elem.title = 'not connected'
  }
}

createDropdown(document.querySelector('header .dropdown'), {
  unmute: () => muteSet.clear(),
  changeTheme: () => theme.setTheme(theme.isDark() ? 'light' : 'dark'),
  about: () => showAbout(),
})

const updateTheme = newTheme => {
  document.body.classList.toggle('dark', newTheme === 'dark')
  const otherTheme = newTheme === 'light' ? 'dark' : 'light'
  document.querySelector('#change-theme').textContent = `Use ${otherTheme} theme`
}

theme.on('themeChange', updateTheme)
updateTheme(theme.getTheme())

const messageInput = document.querySelector('#message')
let awaitingAck = null

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

    const message = {
      text: messageInput.value,
      format: 'image/jpeg',
      ack: awaitingAck
    }
    io.emit('chat', message, frames)
    messageInput.value = ''
    // fire 'change'
    const event = document.createEvent('HTMLEvents')
    event.initEvent('change', false, true)
    messageInput.dispatchEvent(event)
  }).on('progress', percentDone => progressSpinner.setValue(percentDone))
})

io.on('ack', function(ack) {
  if (awaitingAck && awaitingAck === ack.key) {
    messageInput.readonly = false
    awaitingAck = null
    if (ack.err) {
      // TODO(tec27): display to user
      console.log('Error: ' + ack.err)
    }
  }
})

cameraPreview(document.querySelector('#preview').parentNode)

document.addEventListener('visibilitychange', () => {
  document.body.classList.toggle('backgrounded', document.hidden)
  if (!document.hidden) {
    unreadMessages = 0
    updateNotificationCount()
  }
})

const notificationCounter = new NotificationCounter()
function updateNotificationCount() {
  if (!unreadMessages) {
    notificationCounter.clear()
  } else {
    notificationCounter.setCount(unreadMessages)
  }
}

function showAbout() {
  const { scrim, container, dialog } = createAbout()
  document.body.appendChild(scrim)
  document.body.appendChild(container)

  setTimeout(() => {
    scrim.classList.remove('entering')
    dialog.classList.remove('entering')
  }, 15)

  const clickListener = e => {
    if (e.target !== container) return

    container.removeEventListener('click', clickListener)
    // remove the dialog
    scrim.classList.add('will-leave')
    dialog.classList.add('will-leave')

    setTimeout(() => {
      scrim.classList.add('leaving')
      dialog.classList.add('leaving')

      scrim.addEventListener(transitionEvent, () => document.body.removeChild(scrim))
      dialog.addEventListener(transitionEvent, () => document.body.removeChild(container))
    }, 15)
  }
  container.addEventListener('click', clickListener)
}
