import { EventEmitter } from 'events'
import toBlob from 'data-uri-to-blob'

export default function(video, options, cb) {
  if (typeof options == 'function') {
    cb = options
    options = {}
  }
  const opts = {
    numFrames: options.numFrames || 10,
    fps: options.fps || 5,
    format: options.format || 'image/jpeg',
    quality: options.quality || 0.95,
    width: options.width || video.videoWidth,
    height: options.height || video.videoHeight
  }

  const frameDelay = 1000 / opts.fps

  let canvas
  let context
  const frames = new Array(opts.numFrames)
  const emitter = new EventEmitter()
  let awaitingShot = opts.numFrames
  let awaitingSave = opts.numFrames
  let index = 0

  setTimeout(begin, 0)
  return emitter

  function begin() {
    canvas = document.createElement('canvas')
    canvas.width = opts.width
    canvas.height = opts.height
    context = canvas.getContext('2d')

    emitter.emit('progress', 0.1)
    captureFrame()
  }

  function captureFrame() {
    let t
    awaitingShot--
    if (awaitingShot > 0) {
      t = setTimeout(captureFrame, frameDelay)
    }

    (function(i) {
      try {
        // TODO(tec27): handle letterboxing
        context.drawImage(video, 0, 0, canvas.width, canvas.height)
      } catch (err) {
        if (t) clearTimeout(t)

        if (cb) {
          cb(err)
          return
        } else {
          emitter.emit('error', err)
          return
        }
      }

      // + 2 because we want the progress to indicate what frame we are *taking*
      if (i + 1 < opts.numFrames) {
        emitter.emit('progress', (i + 2) / opts.numFrames)
      }
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
    canvas.toBlob(cb, format, opts)
    return
  }

  setTimeout(() => cb(toBlob(canvas.toDataURL(format, opts))), 0)
}
