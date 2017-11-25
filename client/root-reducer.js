import { combineReducers } from 'redux'

import activeUsers from './connection/active-users-reducer'
import connectionStatus from './connection/connection-status-reducer'
import messages from './messages/message-reducer'

export default combineReducers({
  activeUsers,
  connectionStatus,
  messages
})
