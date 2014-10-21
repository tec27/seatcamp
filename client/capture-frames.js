var EventEmitter = require('events').EventEmitter
  , toBlob = require('data-uri-to-blob')

module.exports = function(video, options, cb) {
  if (typeof options == 'function') {
    cb = options
    options = {}
  }
  var opts = {
    numFrames: options.numFrames || 10,
    fps: options.fps || 5,
    format: options.format || 'image/jpeg',
    quality: options.quality || 0.85,
    width: options.width || video.videoWidth,
    height: options.height || video.videoHeight
  }

  var frameDelay = 1000 / opts.fps

  var canvas
    , context
    , frames = new Array(opts.numFrames)
    , emitter = new EventEmitter()
    , awaitingShot = opts.numFrames
    , awaitingSave = opts.numFrames
    , index = 0

  setTimeout(begin, 0)
  return emitter

  function begin() {
    canvas = document.createElement('canvas')
    canvas.width = opts.width
    canvas.height = opts.height
    context = canvas.getContext('2d')

    captureFrame()
  }

  function captureFrame() {
    awaitingShot--
    if (awaitingShot > 0) {
      var t = setTimeout(captureFrame, frameDelay)
    }

    (function(i) {
      // TODO(tec27): handle letterboxing
      try {
        context.drawImage(video, 0, 0, canvas.width, canvas.height)
      } catch (err) {
        if (t) clearTimeout(t)

        if (cb) return cb(err)
        else return emitter.emit('error', err)
      }

      emitter.emit('progress', index / opts.numFrames)
      compatToBlob(canvas, opts.format, opts.quality, function(blob) {
        frames[i] = blob
        awaitingSave--
        maybeDone()
      })
    })(index++)

    function maybeDone() {
      if (awaitingSave) return

      if (cb) {
        cb(null, frames)
      } else {
        emitter.emit('done', frames)
      }
    }
  }
}

function compatToBlob(canvas, format, opts, cb) {
  if (canvas.toBlob) {
    return canvas.toBlob(cb, format, opts)
  }

  setTimeout(function() {
    cb(toBlob(canvas.toDataURL(format, opts)))
  }, 0)
}
