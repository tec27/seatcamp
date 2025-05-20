import { createReadStream, createWriteStream } from 'node:fs'
import { mkdir } from 'node:fs/promises'
import path from 'node:path'
import { pipeline } from 'node:stream/promises'
import concat from 'concat-stream'
import cuid from 'cuid'
import { rimraf } from 'rimraf'

const TMP_DIR = path.join(__dirname, '..', 'tmp') + path.sep

const fileExtensions = {
  'image/jpeg': '.jpg',
  'video/mp4': '.mp4',
}
const videoCodecs = {
  mp4: {
    type: 'ffmpeg',
    ext: '.mp4',
    vcodec: '-vcodec libx264 -pix_fmt yuv420p',
    mime: 'video/mp4',
  },
}

async function writeTempFiles(folder, frames, imgExtension) {
  await mkdir(folder)
  await Promise.all(
    frames.map(
      (frame, i) =>
        new Promise((resolve, reject) => {
          createWriteStream(folder + path.sep + i + imgExtension)
            .on('error', reject)
            .end(frames[i], resolve)
        }),
    ),
  )
}

async function convert(ffmpegRunner, folder, imgExtension) {
  const promises = Object.keys(videoCodecs).map(async codec => {
    const info = videoCodecs[codec]
    const data = await doFfmpeg(ffmpegRunner, folder, imgExtension, info.vcodec, info.ext)
    return {
      codec,
      result: data,
    }
  })

  const results = (await Promise.all(promises)).reduce((acc, { codec, result }) => {
    acc[codec] = result
    return acc
  }, {})

  return results
}

export default async function convertFrame(frames, format, ffmpegRunner) {
  if (!fileExtensions[format]) {
    throw new Error('Invalid input format')
  }

  const id = cuid()
  const folder = TMP_DIR + id
  const imgExtension = fileExtensions[format]

  try {
    await writeTempFiles(folder, frames, imgExtension)
    return await convert(ffmpegRunner, folder, imgExtension)
  } finally {
    try {
      await rimraf(folder)
    } catch (err) {
      console.error('Error deleting folder: ' + folder + '\n' + err)
    }
  }
}

async function doFfmpeg(ffmpegRunner, folder, imgExtension, vcodecArgs, vidExtension) {
  const sep = path.sep
  // 11fps is pretty weird, but this more faithfully reproduces the duration/speed of the original
  // app than 10fps does.
  const command =
    `-r 11 -i "${folder}${sep}%d${imgExtension}" ${vcodecArgs} ` +
    `-crf 21 -preset fast -r 11 -movflags +faststart -tune fastdecode ` +
    `-an "${folder}${sep}vid${vidExtension}"`

  await ffmpegRunner(command, { timeout: 3000 })

  let resolve, reject
  const p = new Promise((_resolve, _reject) => {
    resolve = _resolve
    reject = _reject
  })

  pipeline(createReadStream(`${folder}${sep}vid${vidExtension}`), concat(resolve)).catch(err => {
    reject(err)
  })

  return p
}
