var getUserMedia = navigator.getUserMedia ||
    navigator.webkitGetUserMedia ||
    navigator.mozGetUserMedia ||
    navigator.msGetUserMedia
if (getUserMedia) {
  getUserMedia = getUserMedia.bind(navigator)
}

module.exports = function(video, width, height, cb) {
  if (!getUserMedia) {
    return cb(new Error('Browser doesn\'t support WebRTC'))
  }

  getUserMedia({
    audio: false,
    video: {
      mandatory: {
        minWidth: width,
        minHeight: height
      }
    }
  }, success, failure)

  function success(stream) {
    var url
    if (video.mozSrcObject) {
      video.mozSrcObject = stream
    } else {
      url = window.URL.createObjectURL(stream)
      video.src = url
    }

    video.addEventListener('loadeddata', dataLoaded)
    video.play()

    function dataLoaded() {
      video.removeEventListener('loadeddata', dataLoaded)
      cb(null, new StreamResult(video, stream, url))
    }
  }

  function failure(err) {
    cb(err)
  }
}

class StreamResult {
  constructor(video, stream, url) {
    this.video = video
    this.stream = stream
    this.url = url
    this.stopped = false
  }

  stop() {
    if (this.stopped) return

    if (this.url && this.video.src == this.url) {
      this.video.pause()
      this.video.src = null
      window.URL.revokeObjectURL(this.url)
      this.url = null
    } else if (this.video.mozSrcObject && this.video.mozSrcObject == this.stream) {
      this.video.pause()
      this.video.src = null
    }

    this.stream.stop()
    this.video = null
    this.stream = null
    this.stopped = true
  }
}
