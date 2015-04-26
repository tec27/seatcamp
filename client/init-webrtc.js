var getUserMedia = navigator.getUserMedia ||
    navigator.webkitGetUserMedia ||
    navigator.mozGetUserMedia ||
    navigator.msGetUserMedia
if (getUserMedia) {
  getUserMedia = getUserMedia.bind(navigator)
}

let supportsSourceSelection = !!window.MediaStreamTrack.getSources

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

  return desired == normalized
}

module.exports = function(video, width, height, facing, cb) {
  if (!getUserMedia) {
    return cb(new Error('Browser doesn\'t support WebRTC'))
  }

  let constraints = {
    optional: [
      { minWidth: width },
      { minHeight: height },
      { minAspectRatio: width / height },
    ],
  }
  let hasFrontAndRear = false
  let requestedFacing = false

  if (!facing || !supportsSourceSelection) {
    return getMedia()
  }

  window.MediaStreamTrack.getSources(infos => {
    let found = false
    let hasFront = false
    let hasRear = false

    for (let info of infos) {
      if (info.kind != 'video') continue

      console.dir(info)
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
    var url
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

module.exports.supportsSourceSelection = supportsSourceSelection

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

    if (this.url && this.video.src == this.url) {
      this.video.pause()
      this.video.removeAttribute('src')
      window.URL.revokeObjectURL(this.url)
      this.url = null
    } else if (this.video.mozSrcObject && this.video.mozSrcObject == this.stream) {
      this.video.pause()
      this.video.removeAttribute('src')
    }

    this.stream.stop()
    this.video = null
    this.stream = null
    this.stopped = true
  }
}
