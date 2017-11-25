import keyedReducer from '../reducers/keyed-reducer'
import { ACTIVE_USERS_COUNT } from '../actions'

const DEFAULT_STATE = {
  users: 0,
}

export default keyedReducer(DEFAULT_STATE, {
  [ACTIVE_USERS_COUNT](state, action) {
    return {
      users: action.payload.count
    }
  }
})
