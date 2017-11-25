import React from 'react'
import { connect } from 'react-redux'
import styled from 'styled-components'
import { sendMessage } from './action-creators'

import WebcamPreview from '../webcam/webcam-preview.jsx'

const Input = styled.input`
`

const Submit = styled.button`
`

const Container = styled.div`
  position: fixed;
  bottom: 4px;
  left: 0px;
  right: 0px;

  margin: auto;
  padding: 0;
`

class MessageInput extends React.Component {
  state = {
    message: '',
  }

  _webcamPreview = null
  _setWebcamPreview = elem => { this._webcamPreview = elem }

  render() {
    return <Container>
      <WebcamPreview ref={this._setWebcamPreview}/>
      <form onSubmit={this.onSubmit}>
        <Input value={this.state.message} onChange={this.onChange} />
        <Submit onClick={this.onSubmit}>Send</Submit>
      </form>
    </Container>
  }

  onChange = event => {
    this.setState({
      message: event.target.value
    })
  }

  onSubmit = event => {
    event.preventDefault()
    this.props.dispatch(sendMessage(this.state.message, this._webcamPreview.getVideoElement()))
  }
}

export default connect()(MessageInput)
