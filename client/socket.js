import io from 'socket.io-client'
import getFingerprint from './fingerprint'
import {
  activeUsersCount,
  socketConnected,
  socketDisconnected
} from './connection/action-creators'
import {
  messageReceived
} from './messages/action-creators'

let currentSocket = null
export function getSocket() {
  return currentSocket
}

export default function createSocket(dispatch) {
  const socket = io()
  currentSocket = socket

  socket.on('connect', () => {
    console.log('connected')
    socket.emit('fingerprint', getFingerprint())
    socket.emit('join', 'jpg')

    dispatch(socketConnected())
  }).on('disconnect', () => {
    console.log('disconnected')

    dispatch(socketDisconnected())
  })

  socket.on('active', count => {
    dispatch(activeUsersCount(count))
  }).on('chat', chat => {
    dispatch(messageReceived(chat))
  })
}
