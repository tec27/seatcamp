import './register-components'

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
import { PROTOCOL_VERSION } from '../protocol-version'

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/serviceworker.js')
  })
}

const io = createSocketIoClient()
const muteSet = new StoredSet('mutes')
const progressSpinner = initProgressSpinner(document.querySelector('.progress'))
const messageList = document.querySelector('#message-list')

messageList.muteSet = muteSet

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
io.on('connect', function () {
  io.emit('fingerprint', getFingerprint())
  io.emit('join', 'mp4')
}).on('disconnect', function () {
  active = 0
  updateActiveUsers()
})

io.on('protocolVersion', version => {
  if (PROTOCOL_VERSION !== version) {
    // TODO: display a dialog to refresh
    console.log('protocol version mismatch!')
  }
})

io.on('userid', function (id) {
  messageList.myId = id
})

let isAutoScrolling = true
let autoScrollCalcCallback = null
function calcAutoScroll() {
  autoScrollCalcCallback = null
  const visibleEnd = window.pageYOffset + window.innerHeight
  // the 16px is for some extra slop in this calculation (you can be slightly scrolled up and we
  // still autoscroll)
  const contentHeight = document.body.clientHeight - 16

  isAutoScrolling = visibleEnd > contentHeight
}

document.addEventListener('scroll', () => {
  if (!autoScrollCalcCallback) {
    autoScrollCalcCallback = requestAnimationFrame(calcAutoScroll)
  }
})

let maintainAutoScrollCallback = null
function maintainAutoScroll() {
  maintainAutoScrollCallback = null
  if (isAutoScrolling) {
    // A resize should never move the scroll position away from the bottom of the message list if
    // we were scrolled there (really it should always keep the previous last message visible, but
    // that's more complex to implement for minimal gain)
    window.scrollTo(0, document.body.scrollHeight)
  }
}
window.addEventListener('resize', () => {
  if (!maintainAutoScrollCallback) {
    maintainAutoScrollCallback = requestAnimationFrame(maintainAutoScroll)
  }
})

let unreadMessages = 0
let historyComplete = false
io.on('chat', chat => {
  const messageAdded = messageList.addMessage(chat, isAutoScrolling)
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
  },
  changeTheme: () => {
    const newTheme = theme.isDark() ? 'light' : 'dark'
    theme.setTheme(newTheme)
  },
  about: () => {
    showDialog(createAbout())
  },
}

const updateTheme = newTheme => {
  let curTheme
  if (document.body.classList.contains('dark')) {
    curTheme = 'dark'
    document.body.classList.remove('dark')
  } else if (document.body.classList.contains('light')) {
    curTheme = 'light'
    document.body.classList.remove('light')
  } else {
    curTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  }

  const otherTheme = (newTheme || curTheme) === 'light' ? 'dark' : 'light'
  document.querySelector('#change-theme').textContent = `Use ${otherTheme} theme`

  if ((newTheme && newTheme === 'light') || newTheme === 'dark') {
    document.body.classList.add(newTheme)
  }
}

theme.on('themeChange', updateTheme)
updateTheme(theme.getTheme())

const messageInput = document.querySelector('#message')
const sendButton = document.querySelector('#send')

createCharCounter(messageInput, document.querySelector('#char-counter'), 250)

document.querySelector('form').addEventListener('submit', function (event) {
  event.preventDefault()

  const messageText = messageInput.value
  messageInput.readOnly = true
  sendButton.setAttribute('disabled', true)
  progressSpinner.setValue(0).show()

  captureFrames(
    document.querySelector('#preview'),
    {
      format: 'image/jpeg',
      width: 400,
      height: 300,
    },
    function (err, frames) {
      setTimeout(() => {
        progressSpinner.hide()
        setTimeout(() => progressSpinner.setValue(0), 400)
      }, 400)

      messageInput.value = ''
      messageInput.readOnly = false
      sendButton.removeAttribute('disabled')

      if (err) {
        // TODO(tec27): show to user
        console.error(err)
        return
      }

      const formData = new FormData()
      formData.append('fingerprint', getFingerprint())
      formData.append('message', messageText)
      formData.append('format', 'image/jpeg')
      for (const frame of frames) {
        formData.append('frames', frame)
      }

      fetch('/message', {
        method: 'POST',
        body: formData,
      })
        .then(res => {
          if (!res.ok) {
            throw new Error(`Failed to post message: ${res.status} ${res.statusText}`)
          }
        })
        .catch(err => {
          // TODO(tec27): display to user
          console.error('Error: ' + err)
        })

      // fire 'change'
      const event = document.createEvent('HTMLEvents')
      event.initEvent('change', false, true)
      messageInput.dispatchEvent(event)
    },
  ).on('progress', percentDone => progressSpinner.setValue(percentDone))
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

function showDialog({ scrim, container, dialog }) {
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
