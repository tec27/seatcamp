// We use the minified version because it has the web worker script inlined
import AnimatedGif from 'animated_gif/dist/Animated_GIF.min.js'
import toBlob from 'data-uri-to-blob'

export async function videoToGif({ videoElem, numFrames }) {
  const frameDurationMs = (videoElem.duration * 1000) / numFrames
  const uriData = getSrcUri(videoElem.src)
  const gifCreator = new AnimatedGif({ sampleInterval: 1 })

  const recordingElem = document.createElement('video')
  const canvas = document.createElement('canvas')
  const context = canvas.getContext('2d')

  gifCreator.setSize(videoElem.videoWidth, videoElem.videoHeight)
  gifCreator.setDelay(frameDurationMs)
  canvas.width = videoElem.videoWidth
  canvas.height = videoElem.videoHeight

  try {
    const onLoaded = listenOnce(recordingElem, 'loadeddata')

    recordingElem.src = uriData.uri
    recordingElem.load()
    // Firefox Mobile doesn't like to load videos unless it *really* has to, so we play it to get
    // things started there
    recordingElem.play()

    await onLoaded

    for (let frame = 0; frame < numFrames; frame++) {
      await seek(recordingElem, frame * (frameDurationMs / 1000))
      context.drawImage(recordingElem, 0, 0)
      gifCreator.addFrameImageData(context.getImageData(0, 0, canvas.width, canvas.height))
    }

    const blob = await new Promise(resolve => {
      gifCreator.getBlobGIF(resolve)
    })
    return blob
  } finally {
    uriData.cleanup()
    gifCreator.destroy()
    delete recordingElem.src
  }
}

function getSrcUri(videoElemSrc) {
  if (/^data:/.test(videoElemSrc)) {
    // Work around Firefox not considering data URI's "origin-clean" (meaning we can't draw from the
    // data URI video to our canvas and still be able to call getImageData). Object URIs count as
    // origin-clean correctly, however, so we construct one of those
    const srcBlob = toBlob(videoElemSrc)
    const srcUri = window.URL.createObjectURL(srcBlob)

    return {
      uri: srcUri,
      cleanup() {
        window.URL.revokeObjectURL(srcUri)
      },
    }
  }

  return { uri: videoElemSrc, cleanup: () => {} }
}

// Returns a promise that will resolve when an event occurs, removing the
// listener once it does. An error listener will also be attached with similar
// semantics (rejecting instead of resolving).
function listenOnce(elem, event) {
  return new Promise((resolve, reject) => {
    // Assign a value because ESLint isn't happy otherwise? No idea why
    let errorCb = () => {}

    const cb = () => {
      elem.removeEventListener('seeked', cb)
      elem.removeEventListener('error', errorCb)
      resolve()
    }
    errorCb = err => {
      elem.removeEventListener(event, cb)
      elem.removeEventListener('error', errorCb)
      reject(err)
    }

    elem.addEventListener(event, cb)
    elem.addEventListener('error', errorCb)
  })
}

async function seek(videoElem, timeSeconds) {
  const onSeek = listenOnce(videoElem, 'seeked')
  videoElem.currentTime = timeSeconds
  await onSeek
}
