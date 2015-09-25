import initWebrtc from './init-webrtc'
import svgIcons from './svg-icons'

class CameraPreview {
  constructor(previewContainer) {
    this.container = previewContainer
    this.videoElem = previewContainer.querySelector('video')
    this.facing = null
    this.switchButton = null
    this.videoStream = null

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

  initializeCamera() {
    if (this.videoStream) {
      this.videoStream.stop()
      this.videoStream = null
    }

    initWebrtc(this.videoElem, 200, 150, this.facing, (err, stream) => {
      if (err) {
        // TODO(tec27): display something to the user depending on error type
        console.log('error initializing camera preview:')
        console.dir(err)
        return
      }

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
      this.switchButton.appendChild(svgIcons.cameraRear('invert'))
    } else {
      this.switchButton.appendChild(svgIcons.cameraFront('invert'))
    }

    this.container.appendChild(this.switchButton)
  }

  onSwitchCamera() {
    this.facing = this.facing === 'front' ? 'rear' : 'front'
    window.localStorage.setItem('cameraFacing', this.facing)
    this.initializeCamera()
  }
}

export default function createCameraPreview(previewContainer) {
  return new CameraPreview(previewContainer)
}
