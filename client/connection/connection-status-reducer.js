import { CONNECTION_CONNECTED, CONNECTION_DISCONNECTED } from '../actions'
import keyedReducer from '../reducers/keyed-reducer'

const DEFAULT_STATE = {
  connected: false,
}

export default keyedReducer(DEFAULT_STATE, {
  [CONNECTION_CONNECTED](state, action) {
    return { connected: true }
  },

  [CONNECTION_DISCONNECTED](state, action) {
    return { connected: false }
  }
})
