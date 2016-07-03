let getUserMedia = navigator.getUserMedia ||
    navigator.webkitGetUserMedia ||
    navigator.mozGetUserMedia ||
    navigator.msGetUserMedia
if (getUserMedia) {
  getUserMedia = getUserMedia.bind(navigator)
}

const supportsSourceSelection = !!window.MediaStreamTrack.getSources

function equalsNormalizedFacing(desired, check) {
  let normalized = check
  switch (check) {
    case 'user':
      normalized = 'front'
      break
    case 'environment':
      normalized = 'rear'
      break
  }

  return desired === normalized
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
    } else if (this.video.mozSrcObject && this.video.mozSrcObject === this.stream) {
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


function initWebrtc(video, width, height, facing, cb) {
  if (!getUserMedia) {
    cb(new Error('Browser doesn\'t support WebRTC'))
    return
  }

  const constraints = {
    optional: [
      { minAspectRatio: width / height },
    ],
  }
  let hasFrontAndRear = false
  let requestedFacing = false

  if (!facing || !supportsSourceSelection) {
    getMedia()
    return
  }

  window.MediaStreamTrack.getSources(infos => {
    let found = false
    let hasFront = false
    let hasRear = false

    for (const info of infos) {
      if (info.kind !== 'video') continue

      if (equalsNormalizedFacing(facing, info.facing) && !found) {
        found = true
        requestedFacing = true
        constraints.optional.push({ sourceId: info.id })
      }

      if (equalsNormalizedFacing('front', info.facing)) {
        hasFront = true
      } else if (equalsNormalizedFacing('rear', info.facing)) {
        hasRear = true
      }
    }

    hasFrontAndRear = hasFront && hasRear
    getMedia()
  })

  function getMedia() {
    getUserMedia({
      audio: false,
      video: constraints,
    }, success, failure)
  }

  function success(stream) {
    let url
    video.autoplay = true
    if (video.mozSrcObject) {
      video.mozSrcObject = stream
    } else {
      url = window.URL.createObjectURL(stream)
      video.src = url
    }

    video.addEventListener('loadeddata', dataLoaded)

    function dataLoaded() {
      video.removeEventListener('loadeddata', dataLoaded)
      cb(null,
          new StreamResult(video, stream, url, hasFrontAndRear, requestedFacing ? facing : null))
    }
  }

  function failure(err) {
    cb(err)
  }
}

initWebrtc.supportsSourceSelection = supportsSourceSelection
export default initWebrtc
