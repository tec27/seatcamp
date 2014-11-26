module.exports = function detectVideoSupport() {
  var elem = document.createElement('video')
  return {
    webm: !!elem.canPlayType('video/webm; codecs="vp8"'),
    x264: !!elem.canPlayType('video/mp4; codecs="avc1.42E01E"')
  }
}
