import initWebrtc from './init-webrtc'
import icons from './icons'

class CameraPreview {
  constructor(previewContainer, tracker) {
    this.container = previewContainer
    this.videoElem = previewContainer.querySelector('video')
    this.facing = null
    this.switchButton = null
    this.videoStream = null
    this.tracker = tracker

    this.switchButtonListener = () => this.onSwitchCamera()

    this.loadFacing()
    window.addEventListener('storage', evt => {
      if (evt.key === 'cameraFacing') {
        this.loadFacing()
      }
    })
  }

  loadFacing() {
    const oldFacing = this.facing
    this.facing = window.localStorage.getItem('cameraFacing') || 'front'
    if (this.facing !== oldFacing) {
      this.initializeCamera()
    }
  }

  initializeCamera(attempt = 0) {
    const initTime = Date.now()
    if (this.videoStream) {
      this.videoStream.stop()
      this.videoStream = null
    }

    let timer = setTimeout(() => {
      this.container.classList.remove('camera-enabled')
      timer = null
    }, 15000)

    initWebrtc(this.videoElem, 200, 150, this.facing, (err, stream) => {
      if (timer) {
        clearTimeout(timer)
        timer = null
      }
      if (err) {
        if (attempt < 2 && Date.now() - initTime < 200) {
          // Chrome has a weird problem where if you try to do a getUserMedia request too early, it
          // can return a MediaDeviceNotSupported error (even though nothing is wrong and permission
          // has been granted). So we install a delay and retry a couple times to try and mitigate
          // this
          if ((err.name && err.name === 'MediaDeviceNotSupported') ||
              (err.message && err.message === 'MediaDeviceNotSupported')) {
            setTimeout(() => this.initializeCamera(attempt + 1), 200)
            return
          }
        }
        // TODO(tec27): display something to the user depending on error type
        this.container.classList.remove('camera-enabled')
        console.log('error initializing camera preview:')
        console.dir(err)
        this.tracker.onCameraError(err.name || err.message)
        return
      }

      this.container.classList.add('camera-enabled')
      this.tracker.onCameraInitialized()

      this.videoStream = stream
      this.updateSwitchButton()
    })
  }

  updateSwitchButton() {
    if (this.switchButton) {
      this.container.removeChild(this.switchButton)
      this.switchButton = null
    }

    if (!this.videoStream.facing || !this.videoStream.hasFrontAndRear) return

    this.switchButton = document.createElement('button')
    this.switchButton.classList.add('switch-camera', 'shadow-1')
    const otherCameraTitle = this.videoStream.facing === 'front' ? 'rear' : 'front'
    this.switchButton.setAttribute('title', `Switch to ${otherCameraTitle} camera`)
    this.switchButton.addEventListener('click', this.switchButtonListener)
    if (this.videoStream.facing === 'front') {
      this.switchButton.appendChild(icons.cameraRear('invert'))
    } else {
      this.switchButton.appendChild(icons.cameraFront('invert'))
    }

    this.container.appendChild(this.switchButton)
  }

  onSwitchCamera() {
    this.facing = this.facing === 'front' ? 'rear' : 'front'
    window.localStorage.setItem('cameraFacing', this.facing)
    this.tracker.onCameraFacingChange(this.facing)
    this.initializeCamera()
  }
}

export default function createCameraPreview() {
  return new CameraPreview(...arguments)
}
