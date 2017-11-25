import { EventEmitter } from 'events'
import toBlob from 'data-uri-to-blob'

export default function(video, options = {}) {
  const progressEmitter = new EventEmitter()
  return [progressEmitter, new Promise((resolve, reject) => {
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
    let awaitingShot = opts.numFrames
    let awaitingSave = opts.numFrames
    let index = 0

    const dimens = {
      left: 0,
      top: 0,
      width: video.videoWidth,
      height: video.videoHeight
    }
    const targetAspect = opts.width / opts.height
    const actualAspect = dimens.width / dimens.height
    if (targetAspect > actualAspect) {
      dimens.height = Math.round(dimens.width / targetAspect)
    } else {
      dimens.width = Math.round(dimens.height * targetAspect)
    }
    dimens.left = Math.floor((video.videoWidth - dimens.width) / 2)
    dimens.top = Math.floor((video.videoHeight - dimens.height) / 2)

    setTimeout(begin, 0)

    function begin() {
      canvas = document.createElement('canvas')
      canvas.width = opts.width
      canvas.height = opts.height
      context = canvas.getContext('2d')

      progressEmitter.emit('progress', 0.1)
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
          context.drawImage(
            video,
            dimens.left, dimens.top, dimens.width, dimens.height,
            0, 0, canvas.width, canvas.height)
        } catch (err) {
          if (t) clearTimeout(t)
          reject(err)
        }

        // + 2 because we want the progress to indicate what frame we are *taking*
        if (i + 1 < opts.numFrames) {
          progressEmitter.emit('progress', (i + 2) / opts.numFrames)
        }
        compatToBlob(canvas, opts.format, opts.quality).then(blob => {
          frames[i] = blob
          awaitingSave--
          maybeDone()
        })
      })(index++)

      function maybeDone() {
        if (awaitingSave) return

        resolve(frames)
      }
    }
  })]
}

function compatToBlob(canvas, format, opts) {
  return new Promise((resolve, reject) => {
    if (canvas.toBlob) {
      canvas.toBlob(resolve, format, opts)
    }

    resolve(toBlob(canvas.toDataURL(format, opts)))
  })
}
