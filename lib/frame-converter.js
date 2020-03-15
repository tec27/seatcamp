import cuid from 'cuid'
import fs from 'fs'
import path from 'path'
import concat from 'concat-stream'
import rimraf from 'rimraf'
import thenify from 'thenify'

const mkdirAsync = thenify(fs.mkdir)
const rimrafAsync = thenify(rimraf)

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
  await mkdirAsync(folder)
  await Promise.all(
    frames.map(
      (frame, i) =>
        new Promise((resolve, reject) => {
          fs.createWriteStream(folder + path.sep + i + imgExtension)
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
      await rimrafAsync(folder)
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
    `-crf 19 -preset slow -r 11 ` +
    `-an "${folder}${sep}vid${vidExtension}"`

  await ffmpegRunner(command, { timeout: 3000 })

  return new Promise((resolve, reject) => {
    const readStream = fs.createReadStream(`${folder}${sep}vid${vidExtension}`)
    readStream.on('error', reject)

    readStream.pipe(concat(resolve)).on('error', reject)
  })
}
