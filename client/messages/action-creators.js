import { MESSAGE_RECEIVED } from '../actions'

export function messageReceived(message) {
  return {
    type: MESSAGE_RECEIVED,
    payload: message
  }
}
