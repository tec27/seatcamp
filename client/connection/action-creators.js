import {
  ACTIVE_USERS_COUNT,
  CONNECTION_CONNECTED,
  CONNECTION_DISCONNECTED
} from '../actions'

export function socketConnected() {
  return {
    type: CONNECTION_CONNECTED
  }
}

export function socketDisconnected() {
  return {
    type: CONNECTION_DISCONNECTED
  }
}

export function activeUsersCount(count) {
  return {
    type: ACTIVE_USERS_COUNT,
    payload: {
      count
    }
  }
}
