import { getSocket } from '../socket'
import { SEND_MESSAGE } from '../actions'
import captureFrames from '../webcam/capture-frames'

export function sendMessage(message, videoElem) {
  const [emitter, promise] = captureFrames(videoElem, {
    format: 'image/jpeg',
    width: 200,
    height: 150
  })

  emitter.on('progress', i => console.log('progress: ' + i))

  return promise.then(frames => {
    getSocket().emit('chat', {
      text: message,
      format: 'image/jpeg',
      ack: 'TODO TODO TODO'
    }, frames)
    return {
      type: SEND_MESSAGE,
      payload: {
        message
      }
    }
  })
}
