function polyfillGetUserMedia() {
  if (!navigator.mediaDevices) {
    navigator.mediaDevices = {}
  }

  if (!navigator.mediaDevices.getUserMedia) {
    let oldGetUserMedia = navigator.getUserMedia ||
        navigator.webkitGetUserMedia ||
        navigator.mozGetUserMedia ||
        navigator.msGetUserMedia
    if (oldGetUserMedia) {
      oldGetUserMedia = oldGetUserMedia.bind(navigator)
    } else {
      navigator.mediaDevices.getUserMedia =
        Promise.reject(new Error('Browser doesn\'t support getUserMedia'))
      return
    }

    navigator.mediaDevices.getUserMedia = function(constraints) {
      return new Promise((resolve, reject) => oldGetUserMedia(constraints, resolve, reject))
    }
  }
}

class StreamResult {
  constructor(video, stream, url, hasFrontAndRear, facing) {
    this.video = video
    this.stream = stream
    this.url = url
    this.hasFrontAndRear = hasFrontAndRear
    this.facing = facing
    this.stopped = false
  }

  stop() {
    if (this.stopped) return

    if (this.url && this.video.src === this.url) {
      this.video.pause()
      this.video.removeAttribute('src')
      window.URL.revokeObjectURL(this.url)
      this.url = null
    } else if (
      (this.video.srcObject && this.video.srcObject === this.stream) ||
      (this.video.mozSrcObject && this.video.mozSrcObject === this.stream)
    ) {
      this.video.pause()
      this.video.removeAttribute('src')
    }

    for (const track of this.stream.getTracks()) {
      track.stop()
    }
    this.video = null
    this.stream = null
    this.stopped = true
  }
}


async function initWebrtc(video, width, height, facing) {
  polyfillGetUserMedia()

  const constraints = {
    facingMode: facing,
    width: {
      ideal: 1280
    },
    height: {
      ideal: 720
    },
  }
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: false,
    video: constraints,
  })

  let url
  video.autoplay = true
  video.muted = true
  video.playsInline = true

  if ('srcObject' in video) {
    video.srcObject = stream
  } else if ('mozSrcObject' in video) {
    video.mozSrcObject = stream
  } else {
    url = window.URL.createObjectURL(stream)
    video.src = url
  }

  await new Promise(resolve => {
    const listener = () => {
      video.removeEventListener('loadeddata', listener)
      resolve()
    }
    video.addEventListener('loadeddata', listener)
  })
  return new StreamResult(video, stream, url, true /* hasFrontAndRear */, facing)
}

// TODO(tec27): only set this if there are multiple cameras?
initWebrtc.supportsSourceSelection = true
export default initWebrtc
