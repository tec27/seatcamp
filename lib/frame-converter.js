import cuid from 'cuid'
import fs from 'fs'
import path from 'path'
import concat from 'concat-stream'
import rimraf from 'rimraf'
import { exec } from 'child_process'
import thenify from 'thenify'

const execAsync = thenify(exec, { multiArgs: ['stdout', 'stderr'] })
const mkdirAsync = thenify(fs.mkdir)
const rimrafAsync = thenify(rimraf)

const TMP_DIR = path.join(__dirname, '..', 'tmp') + path.sep

const fileExtensions = {
  'image/jpeg': '.jpg',
  'video/mp4': '.mp4',
}
const videoCodecs = {
  // "filmstrip" jpg view
  jpg: {
    ext: '.jpg',
    command: 'convert -append',
    command7: 'magick convert -append',
  },
  // For legacy (iOS) clients
  mp4: {
    type: 'ffmpeg',
    ext: '.mp4',
    vcodec: '-vcodec libx264 -pix_fmt yuv420p',
    base64: true,
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

async function convert(ffmpegRunner, folder, imgExtension, imageMagick7) {
  const promises = Object.keys(videoCodecs).map(async codec => {
    const info = videoCodecs[codec]
    const data = await (info.type === 'ffmpeg'
      ? doFfmpeg(ffmpegRunner, folder, imgExtension, info.vcodec, info.ext)
      : doOtherCommand(folder, imgExtension, imageMagick7 ? info.command7 : info.command, info.ext))

    return {
      codec,
      result: !info.base64 ? data : `data:${info.mime};base64,${data.toString('base64')}`,
    }
  })

  const results = (await Promise.all(promises)).reduce((acc, { codec, result }) => {
    acc[codec] = result
    return acc
  }, {})

  return results
}

export default async function convertFrame(frames, format, ffmpegRunner, imageMagick7) {
  if (!fileExtensions[format]) {
    throw new Error('Invalid input format')
  }

  const id = cuid()
  const folder = TMP_DIR + id
  const imgExtension = fileExtensions[format]

  try {
    await writeTempFiles(folder, frames, imgExtension)
    return await convert(ffmpegRunner, folder, imgExtension, imageMagick7)
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
  const command =
    `-i "${folder}${sep}%d${imgExtension}" -filter:v "setpts=2.5*PTS" ${vcodecArgs} ` +
    `-an "${folder}${sep}vid${vidExtension}"`

  await ffmpegRunner(command, { timeout: 3000 })

  return new Promise((resolve, reject) => {
    const readStream = fs.createReadStream(`${folder}${sep}vid${vidExtension}`)
    readStream.on('error', reject)

    readStream.pipe(concat(resolve)).on('error', reject)
  })
}

async function doOtherCommand(folder, imgExtension, command, outputExtension) {
  const sep = path.sep
  const toRun = `${command} "${folder}${sep}*${imgExtension}" "${folder}${sep}output${outputExtension}"`
  await execAsync(toRun)

  return new Promise((resolve, reject) => {
    const readStream = fs.createReadStream(`${folder}${sep}output${outputExtension}`)
    readStream.on('error', reject)

    readStream.pipe(concat(resolve)).on('error', reject)
  })
}
