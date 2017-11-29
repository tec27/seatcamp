import { EventEmitter } from 'events'
import toBlob from 'data-uri-to-blob'

export default function(video, options = {}) {
  const progressEmitter = new EventEmitter()
  return {
    progressEmitter,
    promise: takeShots(video, options, progressEmitter)
  }
}

function timeoutPromise(time) {
  let timeoutId
  let reject
  const promise = new Promise((resolve, reject) => {
    timeoutId = setTimeout(resolve, time)
  })
  return [{ id: timeoutId, reject }, promise]
}

class FrameCapturer {
  constructor(video, opts) {
    this.video = video
    this.opts = opts

    this.dimens = {
      left: 0,
      top: 0,
      width: video.videoWidth,
      height: video.videoHeight
    }
    const targetAspect = opts.width / opts.height
    const actualAspect = this.dimens.width / this.dimens.height
    if (targetAspect > actualAspect) {
      this.dimens.height = Math.round(this.dimens.width / targetAspect)
    } else {
      this.dimens.width = Math.round(this.dimens.height * targetAspect)
    }
    this.dimens.left = Math.floor((video.videoWidth - this.dimens.width) / 2)
    this.dimens.top = Math.floor((video.videoHeight - this.dimens.height) / 2)

    this.canvas = document.createElement('canvas')
    this.canvas.width = opts.width
    this.canvas.height = opts.height
    this.context = this.canvas.getContext('2d')
  }

  async captureFrame() {
    this.context.drawImage(
      this.video,
      this.dimens.left, this.dimens.top, this.dimens.width, this.dimens.height,
      0, 0, this.canvas.width, this.canvas.height)

    return compatToBlob(this.canvas, this.opts.format, this.opts.quality)
  }
}

async function takeShots(video, options, progressEmitter) {
  const opts = {
    numFrames: options.numFrames || 10,
    fps: options.fps || 5,
    format: options.format || 'image/jpeg',
    quality: options.quality || 0.92,
    width: options.width || video.videoWidth,
    height: options.height || video.videoHeight
  }

  const frameDelay = 1000 / opts.fps
  progressEmitter.emit('progress', 0.1)
  const frameCap = new FrameCapturer(video, opts)

  let canceled = false
  const timeouts = []
  const promises = []
  for (let i = 0; i < opts.numFrames; i++) {
    const [timeout, promise] = timeoutPromise(i * frameDelay)
    timeouts.push(timeout)
    const capturePromise = promise.then(() => frameCap.captureFrame())
    promises.push(capturePromise)

    if (i + 1 < opts.numFrames) {
      capturePromise.then(() => {
        // + 2 because we want the progress to indicate what frame we are *taking*
        progressEmitter.emit('progress', (i + 2) / opts.numFrames)
      })
    }

    capturePromise.catch(err => {
      if (canceled) {
        return
      }

      canceled = true
      for (const timeout of timeouts) {
        clearTimeout(timeout.id)
        timeout.reject(new Error('Operation canceled'))
      }
      throw err
    })
  }

  return Promise.all(promises)
}

function compatToBlob(canvas, format, opts) {
  return new Promise((resolve, reject) => {
    if (canvas.toBlob) {
      canvas.toBlob(resolve, format, opts)
    }

    resolve(toBlob(canvas.toDataURL(format, opts)))
  })
}
