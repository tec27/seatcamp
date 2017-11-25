import React from 'react'
import { connect } from 'react-redux'
import styled from 'styled-components'

const MessageContainer = styled.div`
  display: flex;
`

const MessageImageContainer = styled.div`
  width: 200px;
  height: 150px;
  position: relative;
  overflow: hidden;
  flex-shrink: 0;
`

const MessageImage = styled.img`
  width: 100%;
  height: 1000%;
  position: absolute;
  top: 0;
  left: 0;
  backface-visibility: hidden;

  animation: filmstrip 0.92s infinite;
  transform: translateZ(0);
`

const MessageText = styled.p``

class Message extends React.Component {
  _srcUrl = null

  shouldComponentUpdate(nextProps) {
    return this.props.message !== nextProps.message
  }

  componentWillMount() {
    this._makeUrl(this.props.message.video, this.props.message.videoMime)
  }

  componentWillUpdate(nextProps) {
    this.dispose()
    this._makeUrl(nextProps.message.video, nextProps.message.videoMime)
  }

  componentWillUnmount() {
    this.dispose()
  }

  _makeUrl(video, videoMime) {
    const blob = new window.Blob([ video ], { type: videoMime })
    this._srcUrl = window.URL.createObjectURL(blob)
  }

  _dispose() {
    if (this._srcUrl) {
      window.URL.revokeObjectURL(this._srcUrl)
      this._srcUrl = null
    }
  }

  render() {
    const { text } = this.props.message
    return <MessageContainer>
      <MessageImageContainer>
        <MessageImage src={this._srcUrl} />
      </MessageImageContainer>
      <MessageText>{text}</MessageText>
    </MessageContainer>
  }
}

class MessageList extends React.Component {
  render() {
    return <div>
      {this.props.messages.map(message =>
        <Message key={message.key} message={message} />)}
    </div>
  }
}

export default connect(state => ({ messages: state.messages }))(MessageList)
