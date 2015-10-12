
export default class Tracker {
  constructor() {
  }

  _ga() {
    if (window.ga) {
      window.ga(...arguments)
    }
  }


  _sendEvent(eventCategory, eventAction, eventLabel) {
    this._ga('send', {
      hitType: 'event',
      eventCategory,
      eventAction,
      eventLabel,
    })
  }

  _sendTiming(timingCategory, timingVar, timingValue, timingLabel) {
    this._ga('send', {
      hitType: 'timing',
      timingCategory,
      timingVar,
      timingValue,
      timingLabel,
    })
  }

  onMessageSent(timing) {
    this._sendEvent('messages', 'sent')
    this._sendTiming('messages', 'sendTime', timing)
  }

  onMessageSendError(errString, timing) {
    this._sendEvent('messages', 'sendError', errString)
    this._sendTiming('messages', 'errorTime', timing)
  }

  onSaveGif() {
    this._sendEvent('messages', 'saveGif')
  }

  onMessageCaptureError(errString) {
    this._sendEvent('messages', 'captureError', errString)
  }

  onUserMuted() {
    this._sendEvent('mutes', 'userMuted')
  }

  onUnmute() {
    this._sendEvent('mutes', 'allUnmuted')
  }

  onCameraInitialized() {
    this._sendEvent('camera', 'initialized')
  }

  onCameraError(errString) {
    this._sendEvent('camera', 'error', errString)
  }

  onCameraFacingChange(newFacing) {
    this._sendEvent('camera', 'changeFacing', newFacing)
  }

  onChangeTheme(newTheme) {
    this._sendEvent('theme', 'change', newTheme)
  }

  onShowAbout() {
    this._sendEvent('about', 'show')
  }
}
