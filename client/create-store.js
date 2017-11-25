import { applyMiddleware, createStore, compose } from 'redux'
import thunk from 'redux-thunk'
import promise from 'redux-promise'
import { batchedSubscribe } from 'redux-batched-subscribe'
import { unstable_batchedUpdates as batchedUpdates } from 'react-dom'
import rootReducer from './root-reducer'

const isDev = (process.env.NODE_ENV || 'development') === 'development'

export default function create() {
  const createMiddlewaredStore = compose(
    applyMiddleware(thunk, promise),
    batchedSubscribe(batchedUpdates),
    isDev && window.devToolsExtension ? window.devToolsExtension() : f => f,
  )(createStore)

  const store = createMiddlewaredStore(rootReducer)
  return store
}
