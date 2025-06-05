import initWebrtc from './init-webrtc'

class CancelToken {
  canceled = false
}

class CameraPreview {
  constructor(previewContainer) {
    this.container = previewContainer
    this.videoElem = previewContainer.querySelector('video')
    this.facing = null
    this.switchButton = null
    this.videoStream = null
    this.initCancelToken = new CancelToken()

    this.switchButtonListener = () => this.onSwitchCamera()

    this.videoElem.addEventListener('playing', () => {
      this.videoElem.classList.remove('paused')
    })

    this.loadFacing()
    window.addEventListener('storage', evt => {
      if (evt.key === 'cameraFacing') {
        this.loadFacing()
      }
    })

    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.stop()
        return
      }

      this.initializeCamera()
    })

    let resizeTimeout = null
    window.addEventListener('resize', evt => {
      if (resizeTimeout) {
        clearTimeout(resizeTimeout)
      }

      resizeTimeout = setTimeout(() => {
        resizeTimeout = null
        this.applyScaling()
      }, 100)
    })
  }

  loadFacing() {
    const oldFacing = this.facing
    this.facing = window.localStorage.getItem('cameraFacing') || 'user'
    if (this.facing !== oldFacing) {
      this.initializeCamera()
    }
  }

  async initializeCamera(attempt = 0) {
    const initTime = Date.now()
    this.stop()

    let timer = setTimeout(() => {
      this.container.classList.remove('camera-enabled')
      timer = null
    }, 15000)

    this.initCancelToken = new CancelToken()

    let stream
    try {
      stream = await initWebrtc(this.videoElem, this.facing, this.initCancelToken)
    } catch (err) {
      if (timer) {
        clearTimeout(timer)
        timer = null
      }
      if (!this.initCancelToken.canceled && attempt < 2 && Date.now() - initTime < 200) {
        // Chrome has a weird problem where if you try to do a getUserMedia request too early, it
        // can return a MediaDeviceNotSupported error (even though nothing is wrong and permission
        // has been granted). So we install a delay and retry a couple times to try and mitigate
        // this
        if (
          (err.name && err.name === 'MediaDeviceNotSupported') ||
          (err.message && err.message === 'MediaDeviceNotSupported')
        ) {
          setTimeout(() => this.initializeCamera(attempt + 1), 200)
          return
        }
      }
      // TODO(tec27): display something to the user depending on error type
      this.container.classList.remove('camera-enabled')
      console.log('error initializing camera preview:')
      console.dir(err)
      return
    }

    if (timer) {
      clearTimeout(timer)
      timer = null
    }

    this.container.classList.add('camera-enabled')

    this.videoStream = stream
    this.applyScaling()
    this.updateSwitchButton()
  }

  applyScaling() {
    if (!this.videoStream) {
      return
    }

    const containerRect = this.videoElem.parentElement.getBoundingClientRect()
    const { left, top, width, height } = calcImageDimens(
      containerRect.width,
      containerRect.height,
      this.videoElem.videoWidth,
      this.videoElem.videoHeight,
    )

    this.videoElem.style.left = `${left}px`
    this.videoElem.style.top = `${top}px`
    this.videoElem.style.width = `${width}px`
    this.videoElem.style.height = `${height}px`
  }

  stop() {
    this.initCancelToken.canceled = true
    if (!this.videoStream) return

    this.videoStream.stop()
    this.videoStream = null
    this.videoElem.classList.add('paused')
  }

  updateSwitchButton() {
    if (this.switchButton) {
      this.container.removeChild(this.switchButton)
      this.switchButton = null
    }

    if (!this.videoStream.facing || !this.videoStream.hasFrontAndRear) return

    this.switchButton = document.createElement('button')
    this.switchButton.classList.add('switch-camera', 'shadow-1')
    const otherCameraTitle = this.videoStream.facing === 'user' ? 'rear' : 'front'
    this.switchButton.setAttribute('title', `Switch to ${otherCameraTitle} camera`)
    this.switchButton.addEventListener('click', this.switchButtonListener)
    if (this.videoStream.facing === 'user') {
      this.switchButton.innerHTML = '<sc-svg-icon invert="true" icon="cameraRear"></sc-svg-icon>'
    } else {
      this.switchButton.innerHTML = '<sc-svg-icon invert="true" icon="cameraFront"></sc-svg-icon>'
    }

    this.container.appendChild(this.switchButton)
  }

  onSwitchCamera() {
    this.facing = this.facing === 'user' ? 'environment' : 'user'
    window.localStorage.setItem('cameraFacing', this.facing)
    this.initializeCamera()
  }
}

export default function createCameraPreview() {
  return new CameraPreview(...arguments)
}

function calcImageDimens(targetWidth, targetHeight, sourceWidth, sourceHeight) {
  let left = 0
  let top = 0
  let width = targetWidth
  let height = targetHeight

  const targetAspect = width / height
  const actualAspect = sourceWidth / sourceHeight

  if (targetAspect > actualAspect) {
    // cut off the top/bottom
    height = Math.round(width / actualAspect)
  } else {
    // cut off the left/right
    width = Math.round(height * actualAspect)
  }

  left = -Math.floor((width - targetWidth) / 2)
  top = -Math.floor((height - targetHeight) / 2)

  return { left, top, width, height }
}
