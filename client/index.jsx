import React from 'react'
import { render } from 'react-dom'
import { Provider } from 'react-redux'
import createStore from './create-store'
import App from './app.jsx'

const root = document.getElementById('app')
const store = createStore()

render(<Provider store={store}>
  <App/>
</Provider>, root)
