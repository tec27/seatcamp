import React from 'react'

export default class WebcamPreview extends React.Component {
  _video = null
  _setVideo = elem => { this._video = elem }

  getVideoElement() {
    return this._video
  }

  render() {
    return <video ref={this._setVideo} />
  }
}
