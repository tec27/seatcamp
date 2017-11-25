import keyedReducer from '../reducers/keyed-reducer'
import { MESSAGE_RECEIVED } from '../actions'

const DEFAULT_STATE = []

export default keyedReducer(DEFAULT_STATE, {
  [MESSAGE_RECEIVED](state, action) {
    return state.concat([action.payload]).slice(-30)
  },
})
