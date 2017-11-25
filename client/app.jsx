import React from 'react'
import { connect } from 'react-redux'
import createSocket from './socket'
import styled from 'styled-components'

import AppBar from './app-bar.jsx'
import MessageInput from './compose/message-input.jsx'
import MessageList from './messages/message-list.jsx'

const AppContainer = styled.div`
  width: 100%;
  height: 100%;
`

class App extends React.Component {
  constructor() {
    super()
    this.socket = null
  }

  componentDidMount() {
    if (!this.socket) {
      this.socket = createSocket(this.props.dispatch)
    }
  }

  componentWillUnmount() {
    if (this.socket) {
      this.socket.close()
      this.socket = null
    }
  }

  render() {
    return <AppContainer>
      <AppBar />
      <MessageList />
      <MessageInput />
    </AppContainer>
  }
}

export default connect()(App)
