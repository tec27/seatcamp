import './register-components'

import cuid from 'cuid'
import createSocketIoClient from 'socket.io-client'
import cameraPreview from './camera-preview'
import captureFrames from './capture-frames'
import getFingerprint from './fingerprint'
import NotificationCounter from './notification-counter'
import StoredSet from './stored-set'
import createCharCounter from './char-counter'
import initProgressSpinner from './progress'
import theme from './theme'
import createAbout from './about'
import Tracker from './analytics'
import { PROTOCOL_VERSION } from '../protocol-version'

const io = createSocketIoClient()
const muteSet = new StoredSet('mutes')
const progressSpinner = initProgressSpinner(document.querySelector('.progress'))
const tracker = new Tracker()
const messageList = document.querySelector('#message-list')

messageList.muteSet = muteSet
messageList.tracker = tracker

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
io.on('connect', function() {
  io.emit('fingerprint', getFingerprint())
  io.emit('join', 'mp4')
}).on('disconnect', function() {
  active = 0
  updateActiveUsers()
})

io.on('protocolVersion', version => {
  if (PROTOCOL_VERSION !== version) {
    // TODO: display a dialog to refresh
    console.log('protocol version mismatch!')
  }
})

io.on('userid', function(id) {
  messageList.myId = id
})

let unreadMessages = 0
let historyComplete = false
io.on('chat', chat => {
  const autoScroll = window.pageYOffset + window.innerHeight + 32 > document.body.clientHeight
  const messageAdded = messageList.addMessage(chat, autoScroll)
  if (messageAdded) {
    hideEmptyState()
  }

  if (historyComplete && messageAdded && document.hidden) {
    unreadMessages++
    updateNotificationCount()
  }
})
  .on('active', numActive => {
    active = numActive
    updateActiveUsers()
  })
  .on('historyComplete', () => {
    if (!historyComplete) {
      historyComplete = true
      if (!messageList.hasMessages()) {
        showEmptyState()
      }
    }
  })

function updateActiveUsers() {
  const elem = document.querySelector('#active-users')
  if (active > 0) {
    elem.innerHTML = '' + active
    elem.title = `${active} active users`
  } else {
    elem.innerHTML = '?'
    elem.title = 'not connected'
  }
}

document.querySelector('#options-dropdown').actions = {
  unmute: () => {
    muteSet.clear()
    tracker.onUnmute()
  },
  changeTheme: () => {
    const newTheme = theme.isDark() ? 'light' : 'dark'
    theme.setTheme(newTheme)
    tracker.onChangeTheme(newTheme)
  },
  about: () => {
    showAbout()
    tracker.onShowAbout()
  },
}

const updateTheme = newTheme => {
  document.body.classList.toggle('dark', newTheme === 'dark')
  const otherTheme = newTheme === 'light' ? 'dark' : 'light'
  document.querySelector('#change-theme').textContent = `Use ${otherTheme} theme`
}

theme.on('themeChange', updateTheme)
updateTheme(theme.getTheme())

const messageInput = document.querySelector('#message')
const sendButton = document.querySelector('#send')
let awaitingAck = null
let sendTime = 0

createCharCounter(messageInput, document.querySelector('#char-counter'), 250)

document.querySelector('form').addEventListener('submit', function(event) {
  event.preventDefault()

  if (awaitingAck) return

  const messageText = messageInput.value
  messageInput.readOnly = true
  sendButton.setAttribute('disabled', true)
  awaitingAck = cuid()
  progressSpinner.setValue(0).show()

  captureFrames(
    document.querySelector('#preview'),
    {
      format: 'image/jpeg',
      width: 200,
      height: 150,
    },
    function(err, frames) {
      setTimeout(() => {
        progressSpinner.hide()
        setTimeout(() => progressSpinner.setValue(0), 400)
      }, 400)

      messageInput.value = ''
      messageInput.readOnly = false
      sendButton.removeAttribute('disabled')

      if (err) {
        awaitingAck = null
        // TODO(tec27): show to user
        tracker.onMessageCaptureError(err.message)
        console.error(err)
        return
      }

      const message = {
        text: messageText,
        format: 'image/jpeg',
        ack: awaitingAck,
      }
      io.emit('chat', message, frames)
      sendTime = Date.now()
      // fire 'change'
      const event = document.createEvent('HTMLEvents')
      event.initEvent('change', false, true)
      messageInput.dispatchEvent(event)
    },
  ).on('progress', percentDone => progressSpinner.setValue(percentDone))
})

io.on('ack', function(ack) {
  if (awaitingAck && awaitingAck === ack.key) {
    const timing = Date.now() - sendTime
    awaitingAck = null
    if (ack.err) {
      // TODO(tec27): display to user
      console.log('Error: ' + ack.err)
      tracker.onMessageSendError('' + ack.err, timing)
    } else {
      tracker.onMessageSent(timing)
    }
  }
})

cameraPreview(document.querySelector('#preview').parentNode, tracker)

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

function showEmptyState() {
  document.body.classList.add('no-messages')
}

function hideEmptyState() {
  document.body.classList.remove('no-messages')
}
